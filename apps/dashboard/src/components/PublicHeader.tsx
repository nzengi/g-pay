"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: [string, string][] = [
  ["/", "Demo"],
  ["/docs", "Docs"],
  ["/api", "API"],
];

export function PublicHeader() {
  const pathname = usePathname();
  return (
    <header className="border-b border-[var(--border)]">
      <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent)]" />
          g-pay
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {TABS.map(([href, label]) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={
                  "px-3 h-9 inline-flex items-center rounded-md transition-colors " +
                  (active
                    ? "bg-[var(--surface-2)] text-[var(--foreground)]"
                    : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)]")
                }
              >
                {label}
              </Link>
            );
          })}
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
  );
}
