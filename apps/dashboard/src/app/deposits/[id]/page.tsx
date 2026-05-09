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

function Detail({ apiKey, id }: { apiKey: string; id: string }) {
  const [status, setStatus] = useState<PaymentStatusResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

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

  async function release() {
    if (!status) return;
    if (!/^[0-9a-fA-F]{64}$/.test(target)) {
      setErr("target_addr_hex must be 32-byte hex");
      return;
    }
    setBusy(true);
    setErr(null);
    setInfo(null);
    try {
      const res = await api.release(apiKey, {
        deposit_id: status.deposit_id,
        target_addr_hex: target,
      });
      setInfo(`Released to ${res.target_addr_hex}`);
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function refund() {
    if (!status) return;
    setBusy(true);
    setErr(null);
    setInfo(null);
    try {
      const res = await api.refund(apiKey, status.deposit_id);
      setInfo(`Refunded to ${res.refund_addr_hex}`);
      await load();
    } catch (e) {
      setErr(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!status) {
    return <div className="text-sm text-[var(--muted)]">Loading…</div>;
  }

  const canRelease = status.state === "approved";
  const canRefund =
    status.state === "rejected" ||
    status.state === "expired" ||
    (status.state === "pending" && Date.now() >= status.expires_at);

  return (
    <div className="space-y-6">
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Deposit</div>
            <div className="mono text-base">{status.deposit_id}</div>
          </div>
          <div
            className="px-2.5 py-1 rounded-full text-xs uppercase tracking-wider"
            style={{
              background: STATE_COLOR[status.state] + "22",
              color: STATE_COLOR[status.state],
              border: `1px solid ${STATE_COLOR[status.state]}66`,
            }}
          >
            {status.state}
          </div>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wider text-[var(--muted)] mb-1">
              Stealth pubkey
            </dt>
            <dd className="mono text-xs break-all">{status.stealth_pubkey_hex}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-[var(--muted)] mb-1">
              Amount hint
            </dt>
            <dd className="mono">{status.amount_hint}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-[var(--muted)] mb-1">
              View tag
            </dt>
            <dd className="mono">0x{status.view_tag.toString(16).padStart(2, "0")}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wider text-[var(--muted)] mb-1">
              Expires
            </dt>
            <dd className="mono">{new Date(status.expires_at).toLocaleString()}</dd>
          </div>
        </dl>
      </div>

      {err && (
        <div className="p-3 rounded-md border border-[var(--danger)] text-[var(--danger)] text-sm">
          {err}
        </div>
      )}
      {info && (
        <div className="p-3 rounded-md border border-[var(--success)] text-[var(--success)] text-sm break-all">
          {info}
        </div>
      )}

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-5">
        <div className="text-sm font-semibold mb-3">Actions</div>
        <div className="space-y-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-[var(--muted)] mb-1.5">
              Release target (32-byte hex)
            </div>
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="cd cd cd cd …"
              className="w-full h-9 px-3 rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-xs mono focus:outline-none focus:border-[var(--accent)]"
              disabled={!canRelease || busy}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={release}
              disabled={!canRelease || busy}
              className="px-4 h-9 rounded-md bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
            >
              Release to treasury slice
            </button>
            <button
              onClick={refund}
              disabled={!canRefund || busy}
              className="px-4 h-9 rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-sm hover:border-[var(--danger)] hover:text-[var(--danger)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Refund to sender
            </button>
          </div>
          {!canRelease && status.state !== "released" && (
            <p className="text-xs text-[var(--muted)]">
              Release becomes available once the deposit is{" "}
              <span className="mono">approved</span> (m-of-n AML attestations).
            </p>
          )}
        </div>
      </div>
    </div>
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
            <h1 className="text-xl font-semibold tracking-tight">Deposit detail</h1>
          </div>
          <Detail apiKey={apiKey} id={id} />
        </div>
      )}
    </ApiKeyGate>
  );
}
