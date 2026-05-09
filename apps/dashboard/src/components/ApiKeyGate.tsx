"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getApiKey } from "../lib/auth";

export function ApiKeyGate({ children }: { children: (apiKey: string) => React.ReactNode }) {
  const router = useRouter();
  const [apiKey, setKey] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    const k = getApiKey();
    if (!k) {
      router.replace("/");
      return;
    }
    setKey(k);
  }, [router]);

  if (apiKey === undefined) {
    return <div className="p-6 text-sm text-[var(--muted)]">Loading…</div>;
  }
  if (apiKey === null) return null;
  return <>{children(apiKey)}</>;
}
