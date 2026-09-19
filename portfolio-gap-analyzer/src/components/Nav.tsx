"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Start here" },
  { href: "/reference", label: "Reference" },
  { href: "/portfolio", label: "Holdings" },
  { href: "/analysis", label: "Gap report" },
  { href: "/themes", label: "Themes" },
  { href: "/research", label: "Research" },
  { href: "/learn", label: "Learn" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span
            className="grid h-6 w-6 place-items-center rounded-[5px] text-[11px] font-bold text-white"
            style={{ background: "var(--accent)" }}
            aria-hidden="true"
          >
            G
          </span>
          <span className="text-[14px] font-semibold tracking-tight text-[var(--text)]">Gapline</span>
        </Link>
        <nav className="flex flex-wrap items-center gap-x-1 gap-y-1" aria-label="Main">
          {LINKS.map((link) => {
            // "/" is a prefix of everything, so the root tab matches exactly or not at all.
            const active =
              link.href === "/" ? pathname === "/" : pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${
                  active
                    ? "bg-[var(--accent-soft)] font-medium text-[var(--accent-text)]"
                    : "text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <span className="ml-auto hidden text-[11.5px] text-[var(--text-faint)] sm:block">
          Research and education — not financial advice
        </span>
      </div>
    </header>
  );
}
