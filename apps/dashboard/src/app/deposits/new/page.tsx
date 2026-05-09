"use client";

import { useState } from "react";
import { ApiKeyGate } from "../../../components/ApiKeyGate";
import { api, ApiError, type ReceivingAddressResponse } from "../../../lib/api";

function Form({ apiKey }: { apiKey: string }) {
  const [customerId, setCustomerId] = useState("");
  const [amountHint, setAmountHint] = useState("100000000");
  const [mint, setMint] = useState("USDC");
  const [expireSeconds, setExpireSeconds] = useState(3600);
  const [refundAddr, setRefundAddr] = useState("00".repeat(32));

  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ReceivingAddressResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setErr(null);
    setResult(null);
    try {
      const res = await api.createReceivingAddress(apiKey, {
        customer_id: customerId,
        amount_hint: amountHint,
        mint,
        expire_seconds: expireSeconds,
        refund_addr_hex: refundAddr,
      });
      setResult(res);
    } catch (e) {
      setErr(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <form
        onSubmit={submit}
        className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-5 space-y-4"
      >
        <Field label="Customer ID">
          <input
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            placeholder="C-1234"
            required
            className={inputCls}
          />
        </Field>
        <Field label="Amount hint (smallest units)">
          <input
            value={amountHint}
            onChange={(e) => setAmountHint(e.target.value)}
            inputMode="numeric"
            pattern="\d+"
            required
            className={`${inputCls} mono`}
          />
        </Field>
        <Field label="Mint">
          <select
            value={mint}
            onChange={(e) => setMint(e.target.value)}
            className={inputCls}
          >
            <option value="USDC">USDC</option>
            <option value="SOL">SOL (native)</option>
          </select>
        </Field>
        <Field label="Expire (seconds)">
          <input
            type="number"
            min={60}
            max={60 * 60 * 24 * 30}
            value={expireSeconds}
            onChange={(e) => setExpireSeconds(parseInt(e.target.value, 10))}
            required
            className={`${inputCls} mono`}
          />
        </Field>
        <Field label="Refund address (32 byte hex)">
          <input
            value={refundAddr}
            onChange={(e) => setRefundAddr(e.target.value)}
            pattern="[0-9a-fA-F]{64}"
            required
            className={`${inputCls} mono text-xs`}
          />
        </Field>

        <button
          type="submit"
          disabled={pending}
          className="w-full h-10 rounded-md bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {pending ? "Generating…" : "Generate receiving address"}
        </button>
      </form>

      <div>
        {err && (
          <div className="p-4 rounded-md border border-[var(--danger)] text-[var(--danger)] text-sm">
            {err}
          </div>
        )}
        {result && (
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-lg p-5 space-y-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-[var(--muted)]">
                Deposit ID
              </div>
              <div className="mono text-sm mt-1">{result.deposit_id}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-[var(--muted)]">
                Stealth pubkey (give this to the customer)
              </div>
              <div className="mono text-xs mt-1 break-all bg-[var(--surface-2)] p-2 rounded border border-[var(--border)]">
                {result.stealth_pubkey_hex}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-[var(--muted)]">
                Ephemeral R
              </div>
              <div className="mono text-xs mt-1 break-all">{result.ephemeral_r_hex}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs uppercase tracking-wider text-[var(--muted)]">
                  View tag
                </div>
                <div className="mono text-sm mt-1">
                  0x{result.view_tag.toString(16).padStart(2, "0")}
                </div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-wider text-[var(--muted)]">
                  Expires
                </div>
                <div className="mono text-sm mt-1">
                  {new Date(result.expires_at).toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const inputCls =
  "w-full h-9 px-3 rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)]";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs uppercase tracking-wider text-[var(--muted)] mb-1.5">
        {label}
      </div>
      {children}
    </label>
  );
}

export default function NewAddressPage() {
  return (
    <ApiKeyGate>
      {(apiKey) => (
        <div className="mx-auto max-w-6xl p-6 space-y-6">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">New receiving address</h1>
            <p className="text-sm text-[var(--muted)] mt-1">
              Generates a fresh stealth address for a single payment. Hand
              <span className="mono"> stealth_pubkey_hex</span> to the customer; the indexer scans on
              your behalf.
            </p>
          </div>
          <Form apiKey={apiKey} />
        </div>
      )}
    </ApiKeyGate>
  );
}
