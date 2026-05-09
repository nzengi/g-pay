"use client";

import { use, useEffect, useState } from "react";
import { ApiKeyGate } from "../../../components/ApiKeyGate";
import { api, ApiError, type PaymentStatusResponse } from "../../../lib/api";

const STATE_COLOR: Record<string, string> = {
  pending: "var(--warn)",
  approved: "var(--accent)",
  rejected: "var(--danger)",
  released: "var(--success)",
  refunded: "var(--muted)",
  expired: "var(--muted)",
};

const STAGES = ["pending", "approved", "released"] as const;

interface TxEntry {
  label: string;
  signature: string;
  url: string;
  ts: number;
}

function shorten(s: string, n = 8): string {
  if (s.length <= 2 * n + 1) return s;
  return `${s.slice(0, n)}…${s.slice(-n)}`;
}

function ExplorerLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[var(--accent)] underline-offset-2 hover:underline mono text-xs break-all"
    >
      {children}
    </a>
  );
}

function StateBadge({ state }: { state: string }) {
  const color = STATE_COLOR[state] ?? "var(--muted)";
  return (
    <span
      className="px-2.5 py-1 rounded-full text-xs uppercase tracking-wider"
      style={{
        background: color + "22",
        color,
        border: `1px solid ${color}66`,
      }}
    >
      {state}
    </span>
  );
}

function Stepper({ state }: { state: string }) {
  const reached = (s: string) => {
    if (state === "released" || state === "refunded") return true;
    if (state === "approved") return s !== "released";
    return s === "pending";
  };
  return (
    <div className="flex items-center gap-2 text-xs">
      {STAGES.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div
            className={
              "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold " +
              (reached(s)
                ? "bg-[var(--accent)] text-[var(--accent-fg)]"
                : "bg-[var(--surface-2)] text-[var(--muted)] border border-[var(--border)]")
            }
          >
            {i + 1}
          </div>
          <div
            className={
              reached(s) ? "text-[var(--foreground)]" : "text-[var(--muted)]"
            }
          >
            {s === "pending"
              ? "Customer pays"
              : s === "approved"
                ? "AML cleared"
                : "Released"}
          </div>
          {i < STAGES.length - 1 && (
            <div
              className={
                "w-8 h-px " +
                (reached(STAGES[i + 1]!)
                  ? "bg-[var(--accent)]"
                  : "bg-[var(--border)]")
              }
            />
          )}
        </div>
      ))}
    </div>
  );
}

function Detail({ apiKey, id }: { apiKey: string; id: string }) {
  const [status, setStatus] = useState<PaymentStatusResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [txs, setTxs] = useState<TxEntry[]>([]);

  async function load() {
    try {
      setStatus(await api.paymentStatus(apiKey, id));
      setErr(null);
    } catch (e) {
      setErr(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e));
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 4_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, id]);

  function recordTxs(label: string, sigs: string[], urls: (string | null)[]) {
    const ts = Date.now();
    setTxs((prev) => [
      ...prev,
      ...sigs.map((sig, i) => ({
        label: sigs.length > 1 ? `${label} #${i + 1}` : label,
        signature: sig,
        url:
          urls[i] ??
          `https://explorer.solana.com/tx/${sig}?cluster=devnet`,
        ts,
      })),
    ]);
  }

  async function run<T extends { signature?: string; signatures?: string[] }>(
    name: string,
    label: string,
    fn: () => Promise<T>,
  ) {
    setBusy(name);
    setErr(null);
    setInfo(null);
    try {
      const res = await fn();
      const sigs = res.signatures ?? (res.signature ? [res.signature] : []);
      const urls = res.signatures
        ? (res as unknown as { explorer_txs?: (string | null)[] })
            .explorer_txs ?? sigs.map(() => null)
        : [
            (res as unknown as { explorer_tx?: string | null }).explorer_tx ??
              null,
          ];
      recordTxs(label, sigs, urls);
      setInfo(`${label}${sigs.length > 1 ? ` (${sigs.length} txs)` : ""} ✓`);
      // Brief grace period so the indexer has had time to scan and post.
      setTimeout(load, 6_000);
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e));
    } finally {
      setBusy(null);
    }
  }

  if (!status) {
    return <div className="text-sm text-[var(--muted)]">Loading…</div>;
  }

  const onChainSeen = !!status.on_chain_address;
  const canSimulate = !onChainSeen && status.state === "pending";
  const canAttest =
    onChainSeen && status.state === "pending";
  const canRelease = status.state === "approved";
  const canRefund =
    status.state === "rejected" ||
    status.state === "expired" ||
    (status.state === "pending" && Date.now() >= status.expires_at);

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-5">
        <Stepper state={status.state} />
      </div>

      {/* Status card */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-[var(--muted)]">
              Deposit
            </div>
            <div className="mono text-base">{status.deposit_id}</div>
          </div>
          <StateBadge state={status.state} />
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wider text-[var(--muted)] mb-1">
              Stealth pubkey (off-chain receive address)
            </dt>
            <dd className="mono text-xs break-all">
              {status.stealth_pubkey_hex}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-[var(--muted)] mb-1">
              Amount hint (lamports)
            </dt>
            <dd className="mono">{status.amount_hint}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-[var(--muted)] mb-1">
              On-chain Deposit account
            </dt>
            <dd>
              {status.on_chain_address ? (
                <ExplorerLink
                  href={`https://explorer.solana.com/address/${status.on_chain_address}?cluster=devnet`}
                >
                  {shorten(status.on_chain_address, 10)} ↗
                </ExplorerLink>
              ) : (
                <span className="text-[var(--muted)] text-xs">
                  — not yet seen on chain
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-[var(--muted)] mb-1">
              Expires
            </dt>
            <dd className="mono text-xs">
              {new Date(status.expires_at).toLocaleString()}
            </dd>
          </div>
        </dl>
      </div>

      {/* Banners */}
      {err && (
        <div className="p-3 rounded-md border border-[var(--danger)] text-[var(--danger)] text-sm">
          {err}
        </div>
      )}
      {info && (
        <div className="p-3 rounded-md border border-[var(--success)] text-[var(--success)] text-sm">
          {info}
        </div>
      )}

      {/* Demo actions */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-5">
        <div className="text-sm font-semibold mb-1">Devnet demo controls</div>
        <p className="text-xs text-[var(--muted)] mb-4">
          Each button below sends a real Solana devnet transaction. Watch the
          state badge above progress as the indexer detects each step.
        </p>

        <div className="grid sm:grid-cols-2 gap-3">
          <ActionButton
            disabled={!canSimulate || !!busy}
            busy={busy === "simulate"}
            label="1. Simulate customer payment"
            hint="Sends 0.1 SOL from a demo wallet → stealth address"
            onClick={() =>
              run("simulate", "Customer paid (deposit on chain)", () =>
                api.demoSimulate(apiKey, status.deposit_id),
              )
            }
          />
          <ActionButton
            disabled={!canAttest || !!busy}
            busy={busy === "attest-clean"}
            label="2a. AML check: clean"
            hint="Two oracles attest CLEAN → state moves to Approved"
            onClick={() =>
              run("attest-clean", "Oracles attested CLEAN", () =>
                api.demoAttest(apiKey, status.deposit_id, "clean"),
              )
            }
          />
          <ActionButton
            disabled={!canAttest || !!busy}
            busy={busy === "attest-dirty"}
            label="2b. AML check: dirty (reject)"
            hint="Two oracles attest DIRTY → state moves to Rejected"
            danger
            onClick={() =>
              run("attest-dirty", "Oracles attested DIRTY", () =>
                api.demoAttest(apiKey, status.deposit_id, "dirty"),
              )
            }
          />
          <ActionButton
            disabled={!canRelease || !!busy}
            busy={busy === "release"}
            label="3. Release to fresh treasury slice"
            hint="Approved deposits move to a new pubkey (no consolidation)"
            primary
            onClick={() =>
              run("release", "Released to treasury slice", () =>
                api.demoRelease(apiKey, status.deposit_id),
              )
            }
          />
          <ActionButton
            disabled={!canRefund || !!busy}
            busy={busy === "refund"}
            label="4. Refund to sender"
            hint="Rejected / expired deposits go back to the depositor"
            onClick={() =>
              run("refund", "Refunded to sender", () =>
                api.demoRefund(apiKey, status.deposit_id),
              )
            }
          />
        </div>
      </div>

      {/* Tx log */}
      {txs.length > 0 && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-5">
          <div className="text-sm font-semibold mb-3">Devnet transactions</div>
          <ul className="space-y-2">
            {txs.map((tx, i) => (
              <li key={i} className="flex items-center justify-between gap-3">
                <div className="text-xs">
                  <span className="text-[var(--muted)]">{tx.label}:</span>{" "}
                  <ExplorerLink href={tx.url}>
                    {shorten(tx.signature, 10)} ↗
                  </ExplorerLink>
                </div>
                <span className="text-[10px] text-[var(--muted)]">
                  {new Date(tx.ts).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ActionButton({
  disabled,
  busy,
  label,
  hint,
  onClick,
  primary,
  danger,
}: {
  disabled: boolean;
  busy: boolean;
  label: string;
  hint: string;
  onClick: () => void;
  primary?: boolean;
  danger?: boolean;
}) {
  const base =
    "text-left p-3 rounded-md border transition-colors disabled:opacity-30 disabled:cursor-not-allowed";
  const tone = primary
    ? "bg-[var(--accent)] text-[var(--accent-fg)] border-[var(--accent)] hover:opacity-90"
    : danger
      ? "bg-[var(--surface-2)] border-[var(--border)] hover:border-[var(--danger)] hover:text-[var(--danger)]"
      : "bg-[var(--surface-2)] border-[var(--border)] hover:border-[var(--accent)]";
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      className={`${base} ${tone}`}
    >
      <div className="text-sm font-medium">
        {busy ? "Submitting…" : label}
      </div>
      <div className={`text-xs mt-0.5 ${primary ? "opacity-80" : "text-[var(--muted)]"}`}>
        {hint}
      </div>
    </button>
  );
}

export default function DepositDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <ApiKeyGate>
      {(apiKey) => (
        <div className="mx-auto max-w-3xl p-6 space-y-6">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Deposit lifecycle
            </h1>
            <p className="text-sm text-[var(--muted)] mt-1">
              Each step below executes a real transaction on Solana devnet.
              Open Solana Explorer links to verify on-chain.
            </p>
          </div>
          <Detail apiKey={apiKey} id={id} />
        </div>
      )}
    </ApiKeyGate>
  );
}
