"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "../lib/api";
import { getApiKey, setApiKey } from "../lib/auth";

const DEMO_KEY = "demo-key-please-rotate";

export default function LandingPage() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (getApiKey()) router.replace("/deposits");
  }, [router]);

  async function startDemo() {
    setBusy(true);
    setErr(null);
    try {
      // Use the relative /api proxy so this works in production via Vercel.
      const res = await fetch("/api/v1/demo/init", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": DEMO_KEY,
        },
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new ApiError(res.status, body?.error ?? res.statusText);
      }
      const json = (await res.json()) as { deposit_id: string };
      setApiKey(DEMO_KEY);
      router.push(`/deposits/${json.deposit_id}`);
    } catch (e) {
      setErr(e instanceof ApiError ? `${e.status}: ${e.message}` : String(e));
      setBusy(false);
    }
  }

  return (
    <main className="flex-1 flex flex-col">
      <section className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-2xl">
          <div className="mb-10 flex items-center gap-2 text-lg font-semibold tracking-tight">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-[var(--accent)]" />
            g-pay
          </div>

          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-4">
            Stealth-address payment privacy<br />for institutions on Solana.
          </h1>
          <p className="text-base text-[var(--muted)] max-w-xl mb-2">
            Each customer payment lands at a freshly derived stealth address,
            an AML attestation gate runs before any funds touch the institution,
            and approved deposits are released to a fresh treasury slice — no
            on-chain link to the main wallet, and no zero-knowledge proofs.
          </p>
          <p className="text-sm text-[var(--muted)] max-w-xl mb-8">
            All actions in this demo execute on Solana <strong>devnet</strong>.
            Each transaction is real and verifiable on Solana Explorer.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mb-8">
            <button
              onClick={startDemo}
              disabled={busy}
              className="h-12 px-6 rounded-md bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {busy ? "Spinning up demo…" : "Try the live demo →"}
            </button>
            <a
              href="/docs"
              className="h-12 px-6 rounded-md border border-[var(--border)] text-sm font-medium hover:border-[var(--accent)] transition-colors inline-flex items-center"
            >
              Docs
            </a>
            <a
              href="/api"
              className="h-12 px-6 rounded-md border border-[var(--border)] text-sm font-medium hover:border-[var(--accent)] transition-colors inline-flex items-center"
            >
              API
            </a>
            <a
              href="https://github.com/nzengi/g-pay"
              target="_blank"
              rel="noopener noreferrer"
              className="h-12 px-6 rounded-md border border-[var(--border)] text-sm font-medium hover:border-[var(--accent)] transition-colors inline-flex items-center"
            >
              GitHub ↗
            </a>
          </div>

          {err && (
            <div className="mb-6 p-3 rounded-md border border-[var(--danger)] text-[var(--danger)] text-sm">
              {err}
            </div>
          )}

          <div className="border-t border-[var(--border)] pt-6 mt-6">
            <details className="text-sm">
              <summary className="cursor-pointer text-[var(--muted)]">
                Sign in with an institution API key (advanced)
              </summary>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!value.trim()) return;
                  setApiKey(value.trim());
                  router.push("/deposits");
                }}
                className="flex flex-col gap-3 mt-4 max-w-sm"
              >
                <input
                  type="password"
                  placeholder="API key"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  autoComplete="off"
                  className="h-10 px-3 rounded-md bg-[var(--surface)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] mono"
                />
                <button
                  type="submit"
                  className="h-10 rounded-md bg-[var(--surface-2)] border border-[var(--border)] text-sm font-medium hover:border-[var(--accent)] transition-colors"
                >
                  Continue
                </button>
                <p className="text-xs text-[var(--muted)]">
                  Demo key:{" "}
                  <code className="mono text-[var(--foreground)]">
                    {DEMO_KEY}
                  </code>
                </p>
              </form>
            </details>
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--border)] px-6 py-4 text-xs text-[var(--muted)] flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div>
          Solana devnet · Anchor program{" "}
          <a
            href="https://explorer.solana.com/address/75HuPfb2n7SD7KtcQnVpCW5SVN3RP9gZ9vTXP4D4ha6C?cluster=devnet"
            target="_blank"
            rel="noopener noreferrer"
            className="mono underline-offset-2 hover:underline"
          >
            75HuPfb2n…D4ha6C ↗
          </a>
        </div>
        <div>Pre-audit. Devnet only. See SECURITY.md.</div>
      </footer>
    </main>
  );
}
