"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getApiKey, setApiKey } from "../lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [value, setValue] = useState("");

  useEffect(() => {
    if (getApiKey()) router.replace("/deposits");
  }, [router]);

  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2 text-lg font-semibold tracking-tight">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-[var(--accent)]" />
          g-pay
        </div>
        <h1 className="text-2xl font-semibold tracking-tight mb-1">Sign in</h1>
        <p className="text-sm text-[var(--muted)] mb-6">
          Enter the API key issued to your institution. Keys are stored in your
          browser only — never sent to our servers.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!value.trim()) return;
            setApiKey(value.trim());
            router.push("/deposits");
          }}
          className="flex flex-col gap-3"
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
            className="h-10 rounded-md bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Continue
          </button>
        </form>
        <p className="mt-6 text-xs text-[var(--muted)]">
          Demo key for the bundled dev gateway:{" "}
          <code className="mono text-[var(--foreground)]">demo-key-please-rotate</code>
        </p>
      </div>
    </main>
  );
}
