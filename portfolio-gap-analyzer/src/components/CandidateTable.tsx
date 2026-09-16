import Link from "next/link";
import { lookupSecurity } from "@/lib/data/securities";
import type { CandidateScreen } from "@/lib/engine/types";
import { formatCompactCurrency, formatPercent, label } from "@/lib/format";

/**
 * Screening results, presented as results.
 *
 * The filter that produced the list is shown above the list itself, because a
 * set of tickers with no criteria attached reads as a shortlist somebody
 * endorsed — which is exactly what this is not.
 */
export function CandidateTable({ screen }: { screen: CandidateScreen }) {
  const rows = screen.symbols.map((symbol) => lookupSecurity(symbol)).filter((s) => s?.kind === "etf");
  if (rows.length === 0) return null;

  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface-2)]">
      <p className="border-b border-[var(--border)] px-4 py-2.5 text-[11.5px] leading-relaxed text-[var(--text-muted)]">
        <span className="font-semibold text-[var(--text)]">Screen used:</span> {screen.description} These are filter
        results, not a shortlist — check each one against your own account, wrapper and country before doing anything
        with it.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="text-left text-[10.5px] uppercase tracking-wide text-[var(--text-faint)]">
              <th className="px-4 py-2 font-medium">Fund</th>
              <th className="px-3 py-2 text-right font-medium">Charge</th>
              <th className="px-3 py-2 text-right font-medium">Size</th>
              <th className="px-3 py-2 text-right font-medium">Spread</th>
              <th className="px-3 py-2 font-medium">Structure</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.map((security) => {
              if (!security || security.kind !== "etf") return null;
              return (
                <tr key={security.symbol}>
                  <td className="px-4 py-2.5">
                    <Link href={`/research/${security.symbol}`} className="font-semibold text-[var(--text)] hover:underline">
                      {security.symbol}
                    </Link>
                    <div className="text-[11.5px] text-[var(--text-muted)]">{security.name}</div>
                  </td>
                  <td className="tnum px-3 py-2.5 text-right font-medium">{formatPercent(security.fund.expenseRatio, 2)}</td>
                  <td className="tnum px-3 py-2.5 text-right text-[var(--text-muted)]">
                    {formatCompactCurrency(security.fund.aumUsd, "USD")}
                  </td>
                  <td className="tnum px-3 py-2.5 text-right text-[var(--text-muted)]">
                    {formatPercent(security.fund.spread, 3)}
                  </td>
                  <td className="px-3 py-2.5 text-[11.5px] text-[var(--text-muted)]">
                    {security.fund.domicile} · {label(security.fund.distribution)}
                    {security.fund.currencyHedged ? " · hedged" : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
