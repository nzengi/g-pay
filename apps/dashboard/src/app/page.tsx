"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getApiKey, setApiKey } from "../lib/auth";

const DEMO_KEY = "g-p_demo_h6kj9d8s7g6f5d4";
const PROGRAM_ID = "75HuPfb2n7SD7KtcQnVpCW5SVN3RP9gZ9vTXP4D4ha6C";

export default function LoginPage() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (getApiKey()) router.replace("/dashboard");
  }, [router]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const k = value.trim();
    if (!k) return;
    setApiKey(k);
    router.push("/dashboard");
  }

  return (
    <main className="flex-1 flex flex-col">
      <header className="border-b border-[var(--border)]">
        <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent)]" />
            g-pay
            <span className="ml-2 text-[10px] uppercase tracking-wider text-[var(--muted)] border border-[var(--border)] rounded px-1.5 py-0.5">
              devnet
            </span>
          </div>
          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="/docs"
              className="px-3 h-9 inline-flex items-center rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)]"
            >
              Docs
            </Link>
            <Link
              href="/api"
              className="px-3 h-9 inline-flex items-center rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)]"
            >
              API
            </Link>
            <a
              href="https://github.com/nzengi/g-pay"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 h-9 inline-flex items-center rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)]"
            >
              GitHub ↗
            </a>
          </nav>
        </div>
      </header>

      <section className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-semibold tracking-tight mb-1">
            Sign in with an institution API key
          </h1>
          <p className="text-sm text-[var(--muted)] mb-6 leading-6">
            Paste a key issued to your institution. Keys live in your browser
            only — they are never sent to anything other than the g-pay
            gateway.
          </p>

          <form onSubmit={submit} className="flex flex-col gap-3">
            <label className="text-xs uppercase tracking-wider text-[var(--muted)]">
              API key
            </label>
            <input
              type="text"
              placeholder="g-p_live_…"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              required
              className="h-11 px-3 rounded-md bg-[var(--surface)] border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--accent)] mono"
            />
            <button
              type="submit"
              disabled={!value.trim()}
              className="h-11 rounded-md bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
            >
              Continue
            </button>
          </form>

          <div className="mt-6 border-t border-[var(--border)] pt-4">
            <button
              onClick={() => setShowHint((s) => !s)}
              className="text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              {showHint ? "▾" : "▸"} Don&apos;t have a key? Use the public demo
              institution
            </button>
            {showHint && (
              <div className="mt-3 p-3 rounded-md bg-[var(--surface)] border border-[var(--border)] text-xs leading-5">
                <p className="text-[var(--muted)] mb-2">
                  This key belongs to a shared demo institution on Solana
                  devnet. Anyone can use it to drive the playground.
                </p>
                <div className="flex items-center gap-2 mb-2">
                  <code className="mono text-[var(--foreground)] flex-1 break-all">
                    {DEMO_KEY}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(DEMO_KEY);
                      setValue(DEMO_KEY);
                    }}
                    className="px-2 h-7 inline-flex items-center text-[10px] uppercase tracking-wider rounded border border-[var(--border)] hover:border-[var(--accent)]"
                  >
                    Copy
                  </button>
                </div>
                <p className="text-[var(--muted)]">
                  Real institutions get keys with{" "}
                  <code className="mono">g-p_live_</code> /{" "}
                  <code className="mono">g-p_test_</code> prefix on V2.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--border)] px-6 py-4 text-xs text-[var(--muted)]">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <div>
            Solana devnet · Anchor program{" "}
            <a
              href={`https://explorer.solana.com/address/${PROGRAM_ID}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="mono underline-offset-2 hover:underline"
            >
              {PROGRAM_ID.slice(0, 10)}…{PROGRAM_ID.slice(-6)}
            </a>
          </div>
          <div>V1 · pre-audit · devnet only</div>
        </div>
      </footer>
    </main>
  );
}
