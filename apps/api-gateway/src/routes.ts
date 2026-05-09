import { Hono } from "hono";
import { z } from "zod";
import { apiKeyAuth } from "./auth.js";
import { deriveStealthAddress } from "./stealth.js";
import type { Store } from "./store/index.js";

const HEX_32 = /^[0-9a-f]{64}$/i;

const ReceivingAddressBody = z.object({
  customer_id: z.string().min(1),
  amount_hint: z.string().regex(/^\d+$/, "uint string"),
  mint: z.string().min(1),
  expire_seconds: z.number().int().min(60).max(60 * 60 * 24 * 30),
  refund_addr_hex: z.string().regex(HEX_32, "32-byte hex"),
});

const ReleaseBody = z.object({
  deposit_id: z.string().min(1),
  target_addr_hex: z.string().regex(HEX_32, "32-byte hex"),
});

const RefundBody = z.object({
  deposit_id: z.string().min(1),
});

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function bytesToHex(b: Uint8Array): string {
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export function buildRouter(store: Store) {
  const app = new Hono();

  app.use("/v1/*", async (c, next) => {
    if (c.req.path.startsWith("/v1/internal/")) {
      return next();
    }
    return apiKeyAuth(store)(c, next);
  });

  app.post("/v1/receiving-address", async (c) => {
    const parsed = ReceivingAddressBody.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: "invalid_body", detail: parsed.error.format() }, 400);
    }
    const inst = c.get("institution");
    const body = parsed.data;

    const addr = deriveStealthAddress(inst.spendPub, inst.viewPub);
    const refundAddr = hexToBytes(body.refund_addr_hex);

    const expiresAt = Date.now() + body.expire_seconds * 1000;
    const deposit = await store.createDeposit({
      institutionId: inst.id,
      customerId: body.customer_id,
      amountHint: BigInt(body.amount_hint),
      mint: body.mint,
      stealthPubkey: addr.stealthPubkey,
      ephemeralR: addr.ephemeralR,
      viewTag: addr.viewTag,
      refundAddr,
      expiresAt,
    });

    return c.json({
      deposit_id: deposit.id,
      stealth_pubkey_hex: bytesToHex(addr.stealthPubkey),
      ephemeral_r_hex: bytesToHex(addr.ephemeralR),
      view_tag: addr.viewTag,
      expires_at: expiresAt,
    });
  });

  app.get("/v1/payment-status/:id", async (c) => {
    const inst = c.get("institution");
    const dep = await store.getDeposit(c.req.param("id"));
    if (!dep || dep.institutionId !== inst.id) {
      return c.json({ error: "not_found" }, 404);
    }
    return c.json({
      deposit_id: dep.id,
      state: dep.state,
      amount_hint: dep.amountHint.toString(),
      stealth_pubkey_hex: bytesToHex(dep.stealthPubkey),
      view_tag: dep.viewTag,
      expires_at: dep.expiresAt,
      on_chain_address: dep.onChainAddress,
      on_chain_amount: dep.onChainAmount?.toString() ?? null,
      on_chain_state: dep.onChainState,
    });
  });

  app.post("/v1/release", async (c) => {
    const parsed = ReleaseBody.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: "invalid_body", detail: parsed.error.format() }, 400);
    }
    const inst = c.get("institution");
    const dep = await store.getDeposit(parsed.data.deposit_id);
    if (!dep || dep.institutionId !== inst.id) {
      return c.json({ error: "not_found" }, 404);
    }
    if (dep.state !== "approved") {
      return c.json({ error: "not_approved", state: dep.state }, 409);
    }
    await store.setDepositState(dep.id, "released");
    return c.json({
      deposit_id: dep.id,
      state: "released",
      target_addr_hex: parsed.data.target_addr_hex,
      note: "gateway tracks release; on-chain submission goes via gpay-cli or relayer",
    });
  });

  app.post("/v1/refund", async (c) => {
    const parsed = RefundBody.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: "invalid_body", detail: parsed.error.format() }, 400);
    }
    const inst = c.get("institution");
    const dep = await store.getDeposit(parsed.data.deposit_id);
    if (!dep || dep.institutionId !== inst.id) {
      return c.json({ error: "not_found" }, 404);
    }
    const allowed =
      dep.state === "rejected" ||
      dep.state === "expired" ||
      (dep.state === "pending" && Date.now() >= dep.expiresAt);
    if (!allowed) {
      return c.json({ error: "not_refundable", state: dep.state }, 409);
    }
    await store.setDepositState(dep.id, "refunded");
    return c.json({
      deposit_id: dep.id,
      state: "refunded",
      refund_addr_hex: bytesToHex(dep.refundAddr),
    });
  });

  app.get("/v1/treasury/deposits", async (c) => {
    const inst = c.get("institution");
    const deposits = await store.listInstitutionDeposits(inst.id);
    return c.json({
      total: deposits.length,
      by_state: deposits.reduce<Record<string, number>>((acc, d) => {
        acc[d.state] = (acc[d.state] ?? 0) + 1;
        return acc;
      }, {}),
    });
  });

  app.get("/v1/treasury/deposits/list", async (c) => {
    const inst = c.get("institution");
    const limit = Math.min(Number(c.req.query("limit") ?? 100), 500);
    const deposits = await store.listInstitutionDeposits(inst.id, limit);
    return c.json({
      total: deposits.length,
      items: deposits.map((d) => ({
        deposit_id: d.id,
        customer_id: d.customerId,
        amount_hint: d.amountHint.toString(),
        mint: d.mint,
        stealth_pubkey_hex: bytesToHex(d.stealthPubkey),
        view_tag: d.viewTag,
        state: d.state,
        created_at: d.createdAt,
        expires_at: d.expiresAt,
        on_chain_address: d.onChainAddress,
        on_chain_amount: d.onChainAmount?.toString() ?? null,
        on_chain_state: d.onChainState,
        on_chain_observed_at: d.onChainObservedAt,
      })),
    });
  });

  return app;
}

const InternalMatchBody = z.object({
  slice_id: z.number(),
  deposit_pubkey: z.string(),
  stealth_pubkey: z.string(),
  amount: z.number().int().nonnegative(),
  state: z.enum(["pending", "approved", "rejected", "released", "refunded", "expired"]),
});

export function buildInternalRouter(store: Store, expectedSecret: string) {
  const app = new Hono();

  app.use("/v1/internal/*", async (c, next) => {
    const secret = c.req.header("x-internal-secret");
    if (!secret || secret !== expectedSecret) {
      return c.json({ error: "forbidden" }, 403);
    }
    await next();
  });

  app.post("/v1/internal/deposit-detected", async (c) => {
    const parsed = InternalMatchBody.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: "invalid_body", detail: parsed.error.format() }, 400);
    }
    const body = parsed.data;
    const stealthHex = base58OrHexToHex(body.stealth_pubkey);
    const updated = await store.applyOnChainMatch(
      stealthHex,
      body.deposit_pubkey,
      BigInt(body.amount),
      body.state,
    );
    if (!updated) {
      return c.json({ error: "no_matching_record", stealth_pubkey: stealthHex }, 404);
    }
    return c.json({
      deposit_id: updated.id,
      institution_id: updated.institutionId,
      gateway_state: updated.state,
    });
  });

  return app;
}

function base58OrHexToHex(s: string): string {
  if (/^[0-9a-f]{64}$/i.test(s)) return s.toLowerCase();
  const decoded = base58Decode(s);
  return [...decoded].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Decode(s: string): Uint8Array {
  let n = 0n;
  for (const ch of s) {
    const idx = B58_ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error(`invalid base58 char: ${ch}`);
    n = n * 58n + BigInt(idx);
  }
  const bytes: number[] = [];
  while (n > 0n) {
    bytes.push(Number(n & 0xffn));
    n >>= 8n;
  }
  for (const ch of s) {
    if (ch === "1") bytes.push(0);
    else break;
  }
  bytes.reverse();
  return Uint8Array.from(bytes);
}
