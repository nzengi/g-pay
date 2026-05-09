"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearApiKey } from "../lib/auth";

const links = [
  { href: "/deposits", label: "Deposits" },
  { href: "/deposits/new", label: "New address" },
];

export function Header() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <header className="border-b border-[var(--border)]">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-6 h-14">
        <Link href="/deposits" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent)]" />
          g-pay
        </Link>
        <nav className="flex items-center gap-1">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={
                  "px-3 h-9 inline-flex items-center text-sm rounded-md transition-colors " +
                  (active
                    ? "bg-[var(--surface-2)] text-[var(--foreground)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)]")
                }
              >
                {l.label}
              </Link>
            );
          })}
          <button
            onClick={() => {
              clearApiKey();
              router.push("/");
            }}
            className="ml-2 px-3 h-9 inline-flex items-center text-sm rounded-md text-[var(--muted)] hover:text-[var(--danger)] transition-colors"
          >
            Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}
