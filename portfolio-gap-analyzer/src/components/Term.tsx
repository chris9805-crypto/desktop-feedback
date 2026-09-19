"use client";

import { GLOSSARY } from "@/lib/content/glossary";
import { useStore } from "@/lib/state/store";

/**
 * A term of art with a plain-English definition one tap away.
 *
 * The definition opens in a bar at the foot of the page rather than a floating
 * tooltip: hover tooltips do not exist on a phone, and positioning a popover
 * near the edge of a narrow screen is exactly the kind of thing that breaks
 * quietly. A bar always has room.
 */
export function Term({ k, children }: { k: keyof typeof GLOSSARY | string; children: React.ReactNode }) {
  const { openTerm, setOpenTerm } = useStore();
  const entry = GLOSSARY[k];
  if (!entry) return <>{children}</>;

  const open = openTerm === k;
  return (
    <button
      type="button"
      onClick={() => setOpenTerm(open ? null : String(k))}
      aria-expanded={open}
      className="cursor-help border-b border-dotted border-[var(--text-faint)] text-left hover:border-[var(--accent)] hover:text-[var(--accent-text)]"
      style={{ font: "inherit", color: "inherit", padding: 0, background: "none" }}
    >
      {children}
    </button>
  );
}

/** The definition bar. Rendered once, in the layout. */
export function TermBar() {
  const { openTerm, setOpenTerm } = useStore();
  if (!openTerm) return null;
  const entry = GLOSSARY[openTerm];
  if (!entry) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border-strong)] bg-[var(--surface)] shadow-[0_-8px_24px_rgba(0,0,0,0.10)]"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      role="status"
    >
      <div className="mx-auto flex max-w-3xl items-start gap-4 px-4 py-3.5">
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-[var(--text)]">{entry.term}</div>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--text-muted)]">{entry.short}</p>
          {entry.note ? <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--text-faint)]">{entry.note}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => setOpenTerm(null)}
          className="shrink-0 rounded-md px-2 py-1 text-[12px] text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
          aria-label="Close definition"
        >
          Close
        </button>
      </div>
    </div>
  );
}
