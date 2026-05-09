import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import { Hono } from "hono";
import { z } from "zod";
import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";
import { apiKeyAuth } from "../auth.js";
import { deriveStealthAddress } from "../stealth.js";
import type { Store } from "../store/index.js";

const exec = promisify(execFile);

const cfg = {
  cli: process.env.GPAY_CLI ?? "/usr/local/bin/gpay-cli",
  rpc: process.env.GPAY_RPC_URL ?? "https://api.devnet.solana.com",
  vaultAuthorityPubkey: process.env.GPAY_VAULT_AUTHORITY ?? "",
  demoWalletKeypair: process.env.GPAY_DEMO_WALLET ?? "/config/demo-wallet.json",
  oracle1Keypair: process.env.GPAY_ORACLE_1 ?? "/config/oracles/o1.json",
  oracle2Keypair: process.env.GPAY_ORACLE_2 ?? "/config/oracles/o2.json",
};

let demoWalletPubkeyCache: string | null = null;
function demoWalletPubkey(): string {
  if (demoWalletPubkeyCache) return demoWalletPubkeyCache;
  try {
    const raw = JSON.parse(readFileSync(cfg.demoWalletKeypair, "utf8"));
    const kp = Keypair.fromSecretKey(Uint8Array.from(raw));
    demoWalletPubkeyCache = kp.publicKey.toBase58();
    return demoWalletPubkeyCache;
  } catch (e) {
    throw new Error(
      `cannot load demo wallet ${cfg.demoWalletKeypair}: ${(e as Error).message}`,
    );
  }
}

const SimulateBody = z.object({ deposit_id: z.string().min(1) });
const AttestBody = z.object({
  deposit_id: z.string().min(1),
  verdict: z.enum(["clean", "dirty"]),
});
const ReleaseBody = z.object({ deposit_id: z.string().min(1) });
const RefundBody = z.object({ deposit_id: z.string().min(1) });

function bytesToHex(b: Uint8Array): string {
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

function bytesToBase58(b: Uint8Array): string {
  return bs58.encode(b);
}

async function runCli(args: string[]): Promise<Record<string, unknown>> {
  const env = { ...process.env, GPAY_RPC_URL: cfg.rpc };
  const { stdout } = await exec(cfg.cli, args, { env, timeout: 60_000 });
  // gpay-cli emits one JSON object on the last line of stdout.
  const lines = stdout.trim().split("\n").filter(Boolean);
  const last = lines[lines.length - 1] ?? "{}";
  try {
    return JSON.parse(last);
  } catch {
    return { raw: stdout };
  }
}

function explorerTx(sig: string): string {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

function explorerAddr(addr: string): string {
  return `https://explorer.solana.com/address/${addr}?cluster=devnet`;
}

export function buildDemoRouter(store: Store) {
  const app = new Hono();

  app.use("/v1/demo/*", apiKeyAuth(store));

  // One-shot deposit creator with judge-friendly defaults: refund_addr is
  // pre-wired to the on-server demo wallet so the refund button later works
  // without any extra setup.
  app.post("/v1/demo/init", async (c) => {
    const inst = c.get("institution");
    let demoPk: string;
    try {
      demoPk = demoWalletPubkey();
    } catch (e) {
      return c.json({ error: "demo_wallet_unavailable", detail: String(e) }, 500);
    }
    const refundBytes = bs58.decode(demoPk);
    const addr = deriveStealthAddress(inst.spendPub, inst.viewPub);
    const expiresAt = Date.now() + 3600 * 1000;
    const dep = await store.createDeposit({
      institutionId: inst.id,
      customerId: `demo-${Date.now().toString(36)}`,
      amountHint: 10_000_000n, // 0.01 SOL — small on purpose so the demo wallet lasts
      mint: "SOL",
      stealthPubkey: addr.stealthPubkey,
      ephemeralR: addr.ephemeralR,
      viewTag: addr.viewTag,
      refundAddr: refundBytes,
      expiresAt,
    });
    return c.json({
      deposit_id: dep.id,
      stealth_pubkey_hex: bytesToHex(dep.stealthPubkey),
      ephemeral_r_hex: bytesToHex(dep.ephemeralR),
      view_tag: dep.viewTag,
      refund_pubkey: demoPk,
      expires_at: expiresAt,
    });
  });

  app.post("/v1/demo/simulate-payment", async (c) => {
    const parsed = SimulateBody.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: "invalid_body" }, 400);
    const inst = c.get("institution");
    const dep = await store.getDeposit(parsed.data.deposit_id);
    if (!dep || dep.institutionId !== inst.id)
      return c.json({ error: "not_found" }, 404);

    const result = await runCli([
      "deposit-sol-direct",
      "--depositor-keypair",
      cfg.demoWalletKeypair,
      "--vault-authority",
      cfg.vaultAuthorityPubkey,
      "--stealth-pubkey-hex",
      bytesToHex(dep.stealthPubkey),
      "--ephemeral-r-hex",
      bytesToHex(dep.ephemeralR),
      "--view-tag",
      String(dep.viewTag),
      "--amount-lamports",
      dep.amountHint.toString(),
      "--refund-addr",
      bytesToBase58(dep.refundAddr),
      "--release-authority",
      demoWalletPubkey(),
      "--expire-seconds",
      String(Math.max(60, Math.floor((dep.expiresAt - Date.now()) / 1000))),
    ]).catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));

    if ("error" in result) {
      return c.json({ stage: "simulate", ...result }, 500);
    }
    const sig = String(result.signature ?? "");
    const depositPda = String(result.deposit_pda ?? "");
    return c.json({
      stage: "simulate",
      signature: sig,
      deposit_pda: depositPda,
      explorer_tx: sig ? explorerTx(sig) : null,
      explorer_account: depositPda ? explorerAddr(depositPda) : null,
    });
  });

  app.post("/v1/demo/attest", async (c) => {
    const parsed = AttestBody.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: "invalid_body" }, 400);
    const inst = c.get("institution");
    const dep = await store.getDeposit(parsed.data.deposit_id);
    if (!dep || dep.institutionId !== inst.id)
      return c.json({ error: "not_found" }, 404);
    if (!dep.onChainAddress)
      return c.json(
        { error: "no_onchain_record", hint: "run simulate-payment first" },
        409,
      );

    const stealthB58 = bytesToBase58(dep.stealthPubkey);
    const ephHex = bytesToHex(dep.ephemeralR);
    const verdict = parsed.data.verdict;

    const sigs: string[] = [];
    for (const oracleKeypair of [cfg.oracle1Keypair, cfg.oracle2Keypair]) {
      const r = await runCli([
        "attest",
        "--oracle-keypair",
        oracleKeypair,
        "--vault-authority",
        cfg.vaultAuthorityPubkey,
        "--deposit-pubkey",
        dep.onChainAddress,
        "--stealth-pubkey",
        stealthB58,
        "--ephemeral-r-hex",
        ephHex,
        "--verdict",
        verdict,
      ]).catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
      if ("error" in r) {
        return c.json(
          { stage: "attest", oracle: oracleKeypair, ...r },
          500,
        );
      }
      sigs.push(String(r.signature ?? ""));
    }

    return c.json({
      stage: "attest",
      verdict,
      signatures: sigs,
      explorer_txs: sigs.map(explorerTx),
    });
  });

  app.post("/v1/demo/release", async (c) => {
    const parsed = ReleaseBody.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: "invalid_body" }, 400);
    const inst = c.get("institution");
    const dep = await store.getDeposit(parsed.data.deposit_id);
    if (!dep || dep.institutionId !== inst.id)
      return c.json({ error: "not_found" }, 404);
    if (dep.state !== "approved")
      return c.json({ error: "not_approved", state: dep.state }, 409);

    // Fresh treasury slice — judge sees the funds land on a brand new pubkey.
    const targetKp = Keypair.generate();
    const target = targetKp.publicKey.toBase58();

    const result = await runCli([
      "release-sol",
      "--release-authority-keypair",
      cfg.demoWalletKeypair,
      "--vault-authority",
      cfg.vaultAuthorityPubkey,
      "--stealth-pubkey",
      bytesToBase58(dep.stealthPubkey),
      "--ephemeral-r-hex",
      bytesToHex(dep.ephemeralR),
      "--target",
      target,
    ]).catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
    if ("error" in result) return c.json({ stage: "release", ...result }, 500);

    const sig = String(result.signature ?? "");
    return c.json({
      stage: "release",
      signature: sig,
      target,
      explorer_tx: sig ? explorerTx(sig) : null,
      explorer_target: explorerAddr(target),
    });
  });

  app.post("/v1/demo/refund", async (c) => {
    const parsed = RefundBody.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: "invalid_body" }, 400);
    const inst = c.get("institution");
    const dep = await store.getDeposit(parsed.data.deposit_id);
    if (!dep || dep.institutionId !== inst.id)
      return c.json({ error: "not_found" }, 404);

    const refundTarget = bytesToBase58(dep.refundAddr);

    const result = await runCli([
      "refund-sol",
      "--caller-keypair",
      cfg.demoWalletKeypair,
      "--vault-authority",
      cfg.vaultAuthorityPubkey,
      "--stealth-pubkey",
      bytesToBase58(dep.stealthPubkey),
      "--ephemeral-r-hex",
      bytesToHex(dep.ephemeralR),
      "--refund-target",
      refundTarget,
    ]).catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
    if ("error" in result) return c.json({ stage: "refund", ...result }, 500);

    const sig = String(result.signature ?? "");
    return c.json({
      stage: "refund",
      signature: sig,
      refund_target: refundTarget,
      explorer_tx: sig ? explorerTx(sig) : null,
    });
  });

  return app;
}
