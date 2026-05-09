"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  badge?: string;
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Playground" },
];

const SECONDARY: NavItem[] = [
  { href: "/docs", label: "Docs" },
  { href: "/api", label: "API reference" },
];

export function AppSidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden lg:block border-r border-[var(--border)] bg-[var(--background)] w-56 shrink-0">
      <nav className="sticky top-0 h-screen flex flex-col p-4 text-sm">
        <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] px-2 mb-2">
          Workspace
        </div>
        <ul className="space-y-0.5 mb-6">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={
                    "flex items-center justify-between px-3 h-9 rounded-md transition-colors " +
                    (active
                      ? "bg-[var(--surface-2)] text-[var(--foreground)] font-medium"
                      : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)]")
                  }
                >
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="text-[10px] uppercase tracking-wider text-[var(--muted)] border border-[var(--border)] rounded px-1.5 py-0.5">
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="text-[10px] uppercase tracking-wider text-[var(--muted)] px-2 mb-2">
          Reference
        </div>
        <ul className="space-y-0.5 mb-6">
          {SECONDARY.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="flex items-center px-3 h-9 rounded-md text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)]"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-auto px-2 pt-4 border-t border-[var(--border)] text-[10px] text-[var(--muted)] leading-5">
          <div>V1 · pre-audit</div>
          <div>devnet only</div>
          <a
            href="https://github.com/nzengi/g-pay"
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-1 hover:text-[var(--foreground)]"
          >
            GitHub ↗
          </a>
        </div>
      </nav>
    </aside>
  );
}
