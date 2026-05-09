"use client";

import { AnchorProvider, BN, Program, type Idl } from "@coral-xyz/anchor";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  type TransactionInstruction,
} from "@solana/web3.js";
import { useEffect, useMemo, useRef, useState } from "react";

import { ApiKeyGate } from "../../components/ApiKeyGate";
import idlJson from "../../idl/quarantine_vault.json";

const PROGRAM_ID = new PublicKey(
  "75HuPfb2n7SD7KtcQnVpCW5SVN3RP9gZ9vTXP4D4ha6C",
);
const VAULT_AUTHORITY = new PublicKey(
  "5EiLNkpp3QiH1wzBEHnCdWSpxREFH2q5jje9S2gVmaMz",
);
const DEMO_AMOUNT_LAMPORTS = 10_000_000; // 0.01 SOL
const API_BASE_PUBLIC = "/api"; // Vercel rewrite to gateway

/* ──────────────────────────────────────────────────────────────────────── */
/*  Types                                                                    */
/* ──────────────────────────────────────────────────────────────────────── */

interface ReceivingAddress {
  deposit_id: string;
  stealth_pubkey_hex: string;
  ephemeral_r_hex: string;
  view_tag: number;
  expires_at: number;
}

interface DepositStatus {
  deposit_id: string;
  state:
    | "pending"
    | "approved"
    | "rejected"
    | "released"
    | "refunded"
    | "expired";
  amount_hint: string;
  stealth_pubkey_hex: string;
  view_tag: number;
  expires_at: number;
  on_chain_address: string | null;
  on_chain_amount: string | null;
  on_chain_state: string | null;
}

interface LogEvent {
  ts: number;
  level: "info" | "success" | "warn" | "error";
  label: string;
  detail?: string;
  endpoint?: { method: string; path: string; status?: number };
  signature?: string;
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Page                                                                     */
/* ──────────────────────────────────────────────────────────────────────── */

export default function PlaygroundPage() {
  return (
    <ApiKeyGate>
      {(apiKey) => (
        <div className="mx-auto max-w-6xl p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight">
              Playground
            </h1>
            <p className="text-sm text-[var(--muted)] mt-1">
              Six-step lifecycle on Solana devnet. Connect your own wallet for
              the customer side, then walk through each API call. Every button
              you press is wired to a real endpoint and a real on-chain
              transaction.
            </p>
          </div>
          <Playground apiKey={apiKey} />
        </div>
      )}
    </ApiKeyGate>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Playground                                                               */
/* ──────────────────────────────────────────────────────────────────────── */

function Playground({ apiKey }: { apiKey: string }) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const { publicKey, sendTransaction, connected } = wallet;

  const [address, setAddress] = useState<ReceivingAddress | null>(null);
  const [status, setStatus] = useState<DepositStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  const [log, setLog] = useState<LogEvent[]>([]);
  const logIdRef = useRef(0);

  function emit(e: Omit<LogEvent, "ts">) {
    setLog((l) => [{ ...e, ts: Date.now() }, ...l].slice(0, 60));
    logIdRef.current += 1;
  }

  /* live balance once wallet is connected */
  useEffect(() => {
    if (!publicKey) {
      setWalletBalance(null);
      return;
    }
    let live = true;
    async function refresh() {
      if (!publicKey) return;
      try {
        const lamports = await connection.getBalance(publicKey);
        if (live) setWalletBalance(lamports / 1e9);
      } catch {
        /* ignore */
      }
    }
    refresh();
    const t = setInterval(refresh, 8_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [publicKey, connection]);

  /* poll deposit status once we have a deposit_id */
  useEffect(() => {
    if (!address) return;
    let live = true;
    async function refresh() {
      try {
        const res = await fetch(
          `${API_BASE_PUBLIC}/v1/payment-status/${address!.deposit_id}`,
          { headers: { "x-api-key": apiKey }, cache: "no-store" },
        );
        if (!res.ok) return;
        const body = (await res.json()) as DepositStatus;
        if (live) setStatus(body);
      } catch {
        /* ignore */
      }
    }
    refresh();
    const t = setInterval(refresh, 4_000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, [address, apiKey]);

  /* ───── helpers ─────────────────────────────────────────────────────── */

  const programReadOnly = useMemo(() => {
    const provider = new AnchorProvider(connection, fakeWallet(), {
      commitment: "confirmed",
    });
    return new Program(idlJson as Idl, provider);
  }, [connection]);

  /* ───── actions ─────────────────────────────────────────────────────── */

  async function runIssueAddress() {
    if (busy) return;
    setBusy("issue");
    emit({ level: "info", label: "Calling /v1/receiving-address …" });
    try {
      const customerId = publicKey ? publicKey.toBase58() : "anon";
      const refundAddrHex = publicKey
        ? Buffer.from(publicKey.toBytes()).toString("hex")
        : "00".repeat(32);
      const body = {
        customer_id: customerId,
        amount_hint: String(DEMO_AMOUNT_LAMPORTS),
        mint: "SOL",
        expire_seconds: 3600,
        refund_addr_hex: refundAddrHex,
      };
      const res = await fetch(`${API_BASE_PUBLIC}/v1/receiving-address`, {
        method: "POST",
        headers: { "x-api-key": apiKey, "content-type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
      });
      const json = (await res.json()) as ReceivingAddress | { error: string };
      if (!res.ok) throw new Error((json as { error: string }).error);
      const addr = json as ReceivingAddress;
      setAddress(addr);
      emit({
        level: "success",
        label: "Receiving address issued",
        detail: `deposit_id ${addr.deposit_id} · stealth ${shortHex(addr.stealth_pubkey_hex)}`,
        endpoint: { method: "POST", path: "/v1/receiving-address", status: res.status },
      });
    } catch (e) {
      emit({ level: "error", label: "Issue address failed", detail: String(e) });
    } finally {
      setBusy(null);
    }
  }

  async function runSignAndPay() {
    if (busy || !address || !publicKey) return;
    setBusy("pay");
    try {
      const stealth = new PublicKey(hexToBytes(address.stealth_pubkey_hex));
      const ephemeralR = hexToBytes(address.ephemeral_r_hex);
      const refundAddr = publicKey;
      const releaseAuthority = publicKey;

      const [vault] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), VAULT_AUTHORITY.toBytes()],
        PROGRAM_ID,
      );
      const [deposit] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("deposit"),
          vault.toBytes(),
          stealth.toBytes(),
          ephemeralR,
        ],
        PROGRAM_ID,
      );

      emit({
        level: "info",
        label: "Building deposit instruction …",
        detail: `deposit PDA ${shortAddr(deposit.toBase58())}`,
      });

      const ix = (await programReadOnly.methods
        .deposit({
          stealthPubkey: stealth,
          ephemeralR: Array.from(ephemeralR) as unknown as number[],
          viewTag: address.view_tag,
          amount: new BN(DEMO_AMOUNT_LAMPORTS),
          refundAddr,
          releaseAuthority,
          expireSeconds: new BN(3599),
        })
        .accountsStrict({
          depositor: publicKey,
          vault,
          deposit,
          systemProgram: SystemProgram.programId,
        })
        .instruction()) as TransactionInstruction;

      const tx = new Transaction().add(ix);
      tx.feePayer = publicKey;
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;

      emit({
        level: "info",
        label: "Wallet popup — sign deposit transaction",
        detail: `0.01 SOL (10,000,000 lamports)`,
      });
      const sig = await sendTransaction(tx, connection);
      emit({
        level: "success",
        label: "Customer deposit submitted",
        signature: sig,
      });
      await connection.confirmTransaction(sig, "confirmed");
      emit({
        level: "info",
        label: "Indexer is scanning. Status will move to on-chain in ~5s.",
      });
    } catch (e) {
      emit({ level: "error", label: "Deposit failed", detail: String(e) });
    } finally {
      setBusy(null);
    }
  }

  async function runAttest(verdict: "clean" | "dirty") {
    if (busy || !address) return;
    setBusy(`attest-${verdict}`);
    try {
      const res = await fetch(`${API_BASE_PUBLIC}/v1/demo/attest`, {
        method: "POST",
        headers: { "x-api-key": apiKey, "content-type": "application/json" },
        body: JSON.stringify({
          deposit_id: address.deposit_id,
          verdict,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? res.statusText);
      const sigs = (body.signatures ?? []) as string[];
      sigs.forEach((sig, i) => {
        emit({
          level: "success",
          label: `Oracle ${i + 1} attested ${verdict}`,
          signature: sig,
        });
      });
      emit({
        level: "info",
        label: `Threshold reached → state will move to ${verdict === "clean" ? "Approved" : "Rejected"} on next indexer pass.`,
        endpoint: { method: "POST", path: "/v1/demo/attest", status: res.status },
      });
    } catch (e) {
      emit({ level: "error", label: "Attest failed", detail: String(e) });
    } finally {
      setBusy(null);
    }
  }

  async function runRelease() {
    if (busy || !address) return;
    setBusy("release");
    try {
      const res = await fetch(`${API_BASE_PUBLIC}/v1/demo/release`, {
        method: "POST",
        headers: { "x-api-key": apiKey, "content-type": "application/json" },
        body: JSON.stringify({ deposit_id: address.deposit_id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? res.statusText);
      emit({
        level: "success",
        label: "Released to fresh treasury slice",
        detail: `target ${shortAddr(body.target ?? "")}`,
        signature: body.signature,
        endpoint: { method: "POST", path: "/v1/demo/release", status: res.status },
      });
    } catch (e) {
      emit({ level: "error", label: "Release failed", detail: String(e) });
    } finally {
      setBusy(null);
    }
  }

  async function runRefund() {
    if (busy || !address) return;
    setBusy("refund");
    try {
      const res = await fetch(`${API_BASE_PUBLIC}/v1/demo/refund`, {
        method: "POST",
        headers: { "x-api-key": apiKey, "content-type": "application/json" },
        body: JSON.stringify({ deposit_id: address.deposit_id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? res.statusText);
      emit({
        level: "success",
        label: "Refunded to depositor",
        detail: `target ${shortAddr(body.refund_target ?? "")}`,
        signature: body.signature,
        endpoint: { method: "POST", path: "/v1/demo/refund", status: res.status },
      });
    } catch (e) {
      emit({ level: "error", label: "Refund failed", detail: String(e) });
    } finally {
      setBusy(null);
    }
  }

  /* ───── derived state ───────────────────────────────────────────────── */

  const haveAddress = !!address;
  const onChainSeen = !!status?.on_chain_address;
  const stateNow = status?.state ?? "pending";
  const canPay =
    connected && haveAddress && !onChainSeen && stateNow === "pending";
  const canAttest = onChainSeen && stateNow === "pending";
  const canRelease = stateNow === "approved";
  const canRefund =
    stateNow === "rejected" ||
    stateNow === "expired" ||
    (status &&
      stateNow === "pending" &&
      Date.now() >= (status?.expires_at ?? 0));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
      <div className="space-y-4">
        <WalletStatusBanner
          connected={connected}
          pubkey={publicKey?.toBase58() ?? null}
          balance={walletBalance}
        />

        <Step
          n={1}
          title="Issue a receiving address"
          tooltip={`Calls POST /v1/receiving-address. The gateway derives a fresh stealth address from the institution's spend_pub + view_pub, and stores a 'pending' deposit row in Postgres.`}
          status={haveAddress ? "done" : "ready"}
          actionLabel={haveAddress ? "Re-issue address" : "Issue address"}
          actionDisabled={!!busy}
          actionBusy={busy === "issue"}
          onAction={runIssueAddress}
          api={{
            method: "POST",
            path: "/v1/receiving-address",
            request: requestBodyFor("issue", publicKey?.toBase58()),
            response: address ? JSON.stringify(address, null, 2) : null,
          }}
        >
          {address ? (
            <KvList
              rows={[
                ["deposit_id", <code key="d" className="mono">{address.deposit_id}</code>],
                [
                  "stealth_pubkey_hex",
                  <code key="s" className="mono break-all">{address.stealth_pubkey_hex}</code>,
                ],
                [
                  "ephemeral_r_hex",
                  <code key="e" className="mono break-all">{address.ephemeral_r_hex}</code>,
                ],
                [
                  "view_tag",
                  <code key="v" className="mono">0x{address.view_tag.toString(16).padStart(2, "0")}</code>,
                ],
              ]}
            />
          ) : null}
        </Step>

        <Step
          n={2}
          title="Customer signs and submits the deposit"
          tooltip={`Builds the program's deposit instruction with your wallet as depositor + refund_addr + release_authority, then opens your wallet for signature. This is a real Solana devnet transaction — your wallet pays the lamports.`}
          status={
            !haveAddress
              ? "blocked"
              : !connected
                ? "blocked"
                : onChainSeen
                  ? "done"
                  : "ready"
          }
          actionLabel="Send 0.01 SOL"
          actionDisabled={!canPay || !!busy}
          actionBusy={busy === "pay"}
          onAction={runSignAndPay}
          blockedReason={
            !haveAddress
              ? "Run step 1 first."
              : !connected
                ? "Connect your wallet first."
                : onChainSeen
                  ? "Already submitted."
                  : null
          }
          api={{
            method: "On-chain ix",
            path: "quarantine_vault::deposit",
            request: address
              ? `Anchor instruction (signed locally)\n\nDepositArgs {\n  stealth_pubkey:    ${address.stealth_pubkey_hex},\n  ephemeral_r:       ${address.ephemeral_r_hex},\n  view_tag:          ${address.view_tag},\n  amount:            ${DEMO_AMOUNT_LAMPORTS},\n  refund_addr:       <your wallet>,\n  release_authority: <your wallet>,\n  expire_seconds:    3599\n}`
              : null,
            response: status?.on_chain_address
              ? `Deposit PDA: ${status.on_chain_address}\non_chain_amount: ${status.on_chain_amount}\non_chain_state: ${status.on_chain_state}`
              : null,
          }}
        />

        <Step
          n={3}
          title="Indexer detection (automatic)"
          tooltip={`The off-chain indexer runs getProgramAccounts every ~5s and scans each Deposit account against the institution's view_priv. When it matches, it POSTs to the gateway's internal /v1/internal/deposit-detected webhook.`}
          status={onChainSeen ? "done" : haveAddress ? "ready" : "blocked"}
          api={{
            method: "GET",
            path: `/v1/payment-status/${address?.deposit_id ?? "<id>"}`,
            request: null,
            response: status ? JSON.stringify(status, null, 2) : null,
          }}
        >
          {status && (
            <div className="text-xs space-y-1">
              <div>
                <span className="text-[var(--muted)]">on_chain_address:</span>{" "}
                {status.on_chain_address ? (
                  <a
                    href={`https://explorer.solana.com/address/${status.on_chain_address}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mono text-[var(--accent)] underline-offset-2 hover:underline"
                  >
                    {shortAddr(status.on_chain_address)} ↗
                  </a>
                ) : (
                  <em className="text-[var(--muted)]">none yet</em>
                )}
              </div>
              <div>
                <span className="text-[var(--muted)]">gateway_state:</span>{" "}
                <StateChip state={status.state} />
              </div>
            </div>
          )}
        </Step>

        <Step
          n={4}
          title="AML attestation (institution side)"
          tooltip={`Calls POST /v1/demo/attest. Two oracle keys (server-side, threshold = 2-of-3) sign the program's attest instruction with the chosen verdict. On the second signature the on-chain state moves to Approved (clean) or Rejected (dirty). In V2 the verdict source is real Chainalysis / TRM scoring instead of demo keys.`}
          status={canAttest ? "ready" : stateNow === "pending" ? "blocked" : "done"}
          actionLabel="Run AML check (clean)"
          actionDisabled={!canAttest || !!busy}
          actionBusy={busy === "attest-clean"}
          onAction={() => runAttest("clean")}
          secondaryAction={{
            label: "Reject (dirty)",
            disabled: !canAttest || !!busy,
            busy: busy === "attest-dirty",
            onClick: () => runAttest("dirty"),
            danger: true,
          }}
          blockedReason={
            !haveAddress
              ? "Run step 1 first."
              : !onChainSeen
                ? "Wait for the indexer to detect your deposit."
                : null
          }
          api={{
            method: "POST",
            path: "/v1/demo/attest",
            request: address
              ? JSON.stringify(
                  {
                    deposit_id: address.deposit_id,
                    verdict: "clean | dirty",
                  },
                  null,
                  2,
                )
              : null,
            response:
              status?.on_chain_state === "approved" ||
              status?.on_chain_state === "rejected"
                ? `on_chain_state: ${status.on_chain_state}`
                : null,
          }}
        />

        <Step
          n={5}
          title="Release / Refund"
          tooltip={`Approved → calls /v1/demo/release which submits the program's release instruction. The release target is a freshly generated pubkey (no consolidation). Rejected/Expired → calls /v1/demo/refund and sends back to your refund_addr.`}
          status={
            stateNow === "released" || stateNow === "refunded"
              ? "done"
              : canRelease || canRefund
                ? "ready"
                : "blocked"
          }
          actionLabel="Release to fresh slice"
          actionDisabled={!canRelease || !!busy}
          actionBusy={busy === "release"}
          onAction={runRelease}
          secondaryAction={{
            label: "Refund to sender",
            disabled: !canRefund || !!busy,
            busy: busy === "refund",
            onClick: runRefund,
          }}
          blockedReason={
            stateNow === "released" || stateNow === "refunded"
              ? null
              : !canRelease && !canRefund
                ? "Need an Approved or Rejected state."
                : null
          }
          api={{
            method: "POST",
            path: "/v1/demo/release | /v1/demo/refund",
            request: address
              ? `{ "deposit_id": "${address.deposit_id}" }`
              : null,
            response: null,
          }}
        />
      </div>

      {/* Right rail: live event log */}
      <aside>
        <div className="lg:sticky lg:top-6">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--border)] flex items-center justify-between">
              <div className="text-sm font-semibold tracking-tight">
                Event log
              </div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--muted)]">
                last {log.length}
              </div>
            </div>
            <ul className="max-h-[80vh] overflow-y-auto divide-y divide-[var(--border)]">
              {log.length === 0 && (
                <li className="px-4 py-8 text-center text-xs text-[var(--muted)]">
                  Events will land here as you click through the steps.
                </li>
              )}
              {log.map((e, i) => (
                <LogRow key={i} event={e} />
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */
/*  Step + helpers                                                           */
/* ──────────────────────────────────────────────────────────────────────── */

function Step({
  n,
  title,
  tooltip,
  status,
  actionLabel,
  actionDisabled,
  actionBusy,
  onAction,
  secondaryAction,
  blockedReason,
  api,
  children,
}: {
  n: number;
  title: string;
  tooltip: string;
  status: "ready" | "done" | "blocked";
  actionLabel?: string;
  actionDisabled?: boolean;
  actionBusy?: boolean;
  onAction?: () => void;
  secondaryAction?: {
    label: string;
    onClick: () => void;
    disabled: boolean;
    busy: boolean;
    danger?: boolean;
  };
  blockedReason?: string | null;
  api: {
    method: string;
    path: string;
    request: string | null;
    response: string | null;
  };
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const dot =
    status === "done"
      ? "bg-[var(--success)]"
      : status === "ready"
        ? "bg-[var(--accent)]"
        : "bg-[var(--muted)]";
  return (
    <section className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-5">
      <div className="flex items-start gap-3">
        <span
          className={`w-7 h-7 shrink-0 rounded-full text-xs font-semibold inline-flex items-center justify-center ${dot} text-white`}
        >
          {n}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <h3 className="text-base font-semibold tracking-tight">{title}</h3>
            <Tooltip content={tooltip} />
          </div>
          {blockedReason && (
            <p className="text-xs text-[var(--muted)] mt-1">{blockedReason}</p>
          )}
        </div>
      </div>

      {children && <div className="mt-4">{children}</div>}

      {(onAction || secondaryAction) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {onAction && actionLabel && (
            <button
              onClick={onAction}
              disabled={actionDisabled}
              className="px-3 h-9 inline-flex items-center rounded-md bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
            >
              {actionBusy ? "Submitting…" : actionLabel}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              disabled={secondaryAction.disabled}
              className={
                "px-3 h-9 inline-flex items-center rounded-md border text-sm font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed " +
                (secondaryAction.danger
                  ? "bg-[var(--surface-2)] border-[var(--border)] hover:border-[var(--danger)] hover:text-[var(--danger)]"
                  : "bg-[var(--surface-2)] border-[var(--border)] hover:border-[var(--accent)]")
              }
            >
              {secondaryAction.busy ? "Submitting…" : secondaryAction.label}
            </button>
          )}
        </div>
      )}

      <div className="mt-4 border-t border-[var(--border)] pt-3">
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          {open ? "▾ Hide technical details" : "▸ Show technical details"}
        </button>
        {open && (
          <div className="mt-3 space-y-3 text-xs">
            <KvList
              rows={[
                [
                  "method",
                  <code key="m" className="mono">{api.method}</code>,
                ],
                [
                  "path",
                  <code key="p" className="mono break-all">{api.path}</code>,
                ],
              ]}
            />
            {api.request && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1">
                  Request
                </div>
                <CodeBlock>{api.request}</CodeBlock>
              </div>
            )}
            {api.response && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] mb-1">
                  Last response
                </div>
                <CodeBlock>{api.response}</CodeBlock>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function WalletStatusBanner({
  connected,
  pubkey,
  balance,
}: {
  connected: boolean;
  pubkey: string | null;
  balance: number | null;
}) {
  if (connected && pubkey) {
    return (
      <div className="flex items-center justify-between gap-3 p-3 rounded-md border border-[var(--border)] bg-[var(--surface)] text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--success)] shrink-0" />
          <span className="text-[var(--muted)]">customer wallet:</span>
          <a
            href={`https://explorer.solana.com/address/${pubkey}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="mono text-[var(--accent)] underline-offset-2 hover:underline truncate"
          >
            {shortAddr(pubkey)} ↗
          </a>
          <span className="text-[var(--muted)] hidden sm:inline">·</span>
          <span className="mono hidden sm:inline">
            {balance == null ? "…" : `${balance.toFixed(4)} SOL`}
          </span>
        </div>
        <a
          href="https://faucet.solana.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--muted)] hover:text-[var(--foreground)] shrink-0"
        >
          devnet faucet ↗
        </a>
      </div>
    );
  }
  return (
    <div className="p-3 rounded-md border border-[var(--warn)] bg-[var(--warn)] bg-opacity-5 text-xs flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--warn)] shrink-0" />
        <span>
          Connect a wallet from the header to play the customer role. Need
          test SOL?{" "}
          <a
            href="https://faucet.solana.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] underline-offset-2 hover:underline"
          >
            devnet faucet ↗
          </a>
        </span>
      </div>
    </div>
  );
}

function LogRow({ event }: { event: LogEvent }) {
  const dot =
    event.level === "error"
      ? "bg-[var(--danger)]"
      : event.level === "warn"
        ? "bg-[var(--warn)]"
        : event.level === "success"
          ? "bg-[var(--success)]"
          : "bg-[var(--accent)]";
  return (
    <li className="px-4 py-3 text-xs leading-5">
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <div className="font-medium">{event.label}</div>
            <span className="text-[10px] text-[var(--muted)] mono shrink-0">
              {new Date(event.ts).toLocaleTimeString()}
            </span>
          </div>
          {event.endpoint && (
            <div className="text-[10px] text-[var(--muted)] mono">
              {event.endpoint.method} {event.endpoint.path}
              {event.endpoint.status != null && ` → ${event.endpoint.status}`}
            </div>
          )}
          {event.detail && (
            <div className="text-[var(--muted)] break-all">{event.detail}</div>
          )}
          {event.signature && (
            <a
              href={`https://explorer.solana.com/tx/${event.signature}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--accent)] underline-offset-2 hover:underline mono break-all"
            >
              tx {shortAddr(event.signature)} ↗
            </a>
          )}
        </div>
      </div>
    </li>
  );
}

function Tooltip({ content }: { content: string }) {
  return (
    <span className="relative group inline-flex">
      <span className="w-4 h-4 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-[10px] inline-flex items-center justify-center cursor-help text-[var(--muted)]">
        ?
      </span>
      <span className="invisible group-hover:visible absolute left-6 top-0 z-10 w-72 p-2.5 rounded-md bg-[var(--background)] border border-[var(--border)] text-[11px] leading-5 shadow-lg text-[var(--foreground)]">
        {content}
      </span>
    </span>
  );
}

function StateChip({ state }: { state: string }) {
  const color =
    state === "approved"
      ? "var(--accent)"
      : state === "released"
        ? "var(--success)"
        : state === "rejected"
          ? "var(--danger)"
          : state === "refunded" || state === "expired"
            ? "var(--muted)"
            : "var(--warn)";
  return (
    <span
      className="inline-flex items-center px-2 h-5 rounded text-[10px] font-semibold uppercase tracking-wider"
      style={{ background: `${color}22`, color, border: `1px solid ${color}66` }}
    >
      {state}
    </span>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="bg-[var(--surface-2)] border border-[var(--border)] rounded p-2 text-[11px] overflow-x-auto leading-5 mono">
      <code>{children}</code>
    </pre>
  );
}

function KvList({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="text-xs space-y-1.5">
      {rows.map(([k, v], i) => (
        <div key={i} className="flex flex-wrap gap-2">
          <dt className="text-[var(--muted)] shrink-0 w-32">{k}</dt>
          <dd className="flex-1 min-w-0">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ──────────────────────────────────────────────────────────────────────── */

function shortAddr(s: string, n = 6): string {
  if (s.length <= 2 * n + 1) return s;
  return `${s.slice(0, n)}…${s.slice(-n)}`;
}

function shortHex(s: string, n = 8): string {
  if (s.length <= 2 * n + 1) return s;
  return `${s.slice(0, n)}…${s.slice(-n)}`;
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function requestBodyFor(_: "issue", customer?: string | null): string {
  const body = {
    customer_id: customer ?? "anon",
    amount_hint: String(DEMO_AMOUNT_LAMPORTS),
    mint: "SOL",
    expire_seconds: 3600,
    refund_addr_hex: "<your wallet pubkey, hex>",
  };
  return JSON.stringify(body, null, 2);
}

/* anchor wants a "wallet" object even for read-only program methods */
function fakeWallet() {
  return {
    publicKey: PublicKey.default,
    signTransaction: async <T,>(tx: T) => tx,
    signAllTransactions: async <T,>(txs: T[]) => txs,
  };
}
