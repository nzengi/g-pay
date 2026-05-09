"use client";

import { useEffect, useState } from "react";
import { ApiKeyGate } from "../../components/ApiKeyGate";
import { api, type TreasurySummaryResponse, ApiError } from "../../lib/api";

const STATE_COLOR: Record<string, string> = {
  pending: "var(--warn)",
  approved: "var(--accent)",
  rejected: "var(--danger)",
  released: "var(--success)",
  refunded: "var(--muted)",
  expired: "var(--muted)",
};

function Summary({ apiKey }: { apiKey: string }) {
  const [data, setData] = useState<TreasurySummaryResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      setData(await api.treasurySummary(apiKey));
      setErr(null);
    } catch (e) {
      setErr(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e));
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 5_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  if (err) {
    return (
      <div className="p-4 rounded-md border border-[var(--danger)] text-[var(--danger)] text-sm">
        {err}
      </div>
    );
  }
  if (!data) return <div className="text-sm text-[var(--muted)]">Loading…</div>;

  const stateOrder = ["pending", "approved", "rejected", "released", "refunded", "expired"];

  return (
    <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <div className="col-span-2 sm:col-span-3 lg:col-span-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4">
        <div className="text-xs uppercase tracking-wider text-[var(--muted)]">Total deposits</div>
        <div className="mt-2 text-3xl font-semibold mono">{data.total}</div>
      </div>
      {stateOrder.map((s) => (
        <div
          key={s}
          className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-4"
        >
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: STATE_COLOR[s] }}
            />
            <div className="text-xs uppercase tracking-wider text-[var(--muted)]">{s}</div>
          </div>
          <div className="mt-2 text-2xl font-semibold mono">{data.by_state[s] ?? 0}</div>
        </div>
      ))}
    </section>
  );
}

export default function DepositsPage() {
  return (
    <ApiKeyGate>
      {(apiKey) => (
        <div className="mx-auto max-w-6xl p-6 space-y-6">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Deposits</h1>
            <p className="text-sm text-[var(--muted)] mt-1">
              Live aggregate of deposits handled by g-pay for your institution. Auto-refreshes every 5s.
            </p>
          </div>
          <Summary apiKey={apiKey} />
          <div className="text-xs text-[var(--muted)]">
            Per-deposit table will arrive when the gateway exposes the list endpoint
            (next iteration adds Postgres + paginated query).
          </div>
        </div>
      )}
    </ApiKeyGate>
  );
}
