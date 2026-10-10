"use client";

import { RISK_TOLERANCES, riskMix, type RiskTolerance } from "@/lib/engine/primer";

/**
 * Five explicit options rather than a slider.
 *
 * A slider asks the reader to pick a number on a scale whose ends they cannot
 * see. Five buttons, each with the band's own name and the fall it stands for
 * written underneath, ask a question someone can actually answer about
 * themselves.
 */
export function RiskPicker({
  value,
  onChange,
}: {
  value: RiskTolerance;
  onChange: (value: RiskTolerance) => void;
}) {
  const chosen = riskMix(value);
  return (
    <div>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5" role="radiogroup" aria-label="How much movement you can live with">
        {RISK_TOLERANCES.map((level) => {
          const mix = riskMix(level);
          const active = level === value;
          return (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(level)}
              className={`rounded-lg border px-1.5 py-2 text-[12px] font-medium leading-tight transition-colors ${
                active
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]"
                  : "border-[var(--border-strong)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
              }`}
            >
              {mix.label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[12.5px] leading-snug text-[var(--text-muted)]">
        <span className="font-medium text-[var(--text)]">&ldquo;{chosen.statement}&rdquo;</span>{" "}
        <span className="text-[var(--text-faint)]">
          That puts about {Math.round(chosen.equityShare * 100)}% in shares, and sets your reference portfolio too.
        </span>
      </p>
    </div>
  );
}
