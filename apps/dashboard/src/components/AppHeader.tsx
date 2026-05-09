"use client";

import { WalletModalButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearApiKey } from "../lib/auth";

function shortAddr(s: string, n = 4): string {
  if (s.length <= 2 * n + 1) return s;
  return `${s.slice(0, n)}…${s.slice(-n)}`;
}

export function AppHeader() {
  const router = useRouter();
  const { publicKey, connected } = useWallet();
  return (
    <header className="border-b border-[var(--border)] bg-[var(--background)]">
      <div className="h-14 px-6 flex items-center justify-between">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent)]" />
          g-pay
          <span className="ml-2 text-[10px] uppercase tracking-wider text-[var(--muted)] border border-[var(--border)] rounded px-1.5 py-0.5">
            devnet
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {connected && publicKey ? (
            <a
              href={`https://explorer.solana.com/address/${publicKey.toBase58()}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs mono text-[var(--muted)] hover:text-[var(--foreground)] hidden sm:inline-flex items-center gap-1.5"
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--success)]"
                aria-hidden
              />
              {shortAddr(publicKey.toBase58())} ↗
            </a>
          ) : null}
          <WalletModalButton
            style={{
              background: connected ? "var(--surface-2)" : "var(--accent)",
              color: connected ? "var(--foreground)" : "var(--accent-fg)",
              borderRadius: 6,
              height: 34,
              padding: "0 12px",
              fontSize: 13,
              fontWeight: 500,
              border: connected ? "1px solid var(--border)" : "none",
            }}
          />
          <button
            onClick={() => {
              clearApiKey();
              router.push("/");
            }}
            className="px-3 h-9 inline-flex items-center text-sm rounded-md text-[var(--muted)] hover:text-[var(--danger)] transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
