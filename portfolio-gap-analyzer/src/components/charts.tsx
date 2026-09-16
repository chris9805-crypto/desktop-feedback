import { formatPercent, formatPp } from "@/lib/format";

const PALETTE = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
];

export interface Slice {
  label: string;
  value: number;
}

/**
 * A stacked proportion bar. Preferred over a pie for part-to-whole here: the
 * categories are ordered and the eye compares lengths far more reliably than
 * angles.
 */
export function StackedBar({ slices, height = 14 }: { slices: Slice[]; height?: number }) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  if (total <= 0) return null;
  return (
    <div>
      <div
        className="flex w-full overflow-hidden rounded-full"
        style={{ height }}
        role="img"
        aria-label={slices.map((s) => `${s.label} ${formatPercent(s.value / total)}`).join(", ")}
      >
        {slices.map((slice, index) => (
          <div
            key={slice.label}
            style={{ width: `${(slice.value / total) * 100}%`, background: PALETTE[index % PALETTE.length] }}
            title={`${slice.label} ${formatPercent(slice.value / total)}`}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {slices.map((slice, index) => (
          <li key={slice.label} className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)]">
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-[2px]"
              style={{ background: PALETTE[index % PALETTE.length] }}
              aria-hidden="true"
            />
            {slice.label}
            <span className="tnum font-medium text-[var(--text)]">{formatPercent(slice.value / total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface GapRow {
  label: string;
  current: number;
  reference: number;
}

/**
 * The central visual of the whole tool: what you hold, against the reference,
 * with the difference called out. The reference is drawn as a tick mark rather
 * than a second bar so that the comparison reads as one measurement against a
 * benchmark, not as two competing values.
 */
export function GapBars({ rows, threshold = 0.05 }: { rows: GapRow[]; threshold?: number }) {
  const max = Math.max(...rows.flatMap((r) => [r.current, r.reference]), 0.01);
  return (
    <table className="w-full">
      <caption className="sr-only">Your weight against the reference model weight, by category</caption>
      <thead className="sr-only">
        <tr>
          <th>Category</th>
          <th>Your weight</th>
          <th>Reference weight</th>
          <th>Difference</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const delta = row.current - row.reference;
          const material = Math.abs(delta) >= threshold;
          const tone = !material ? "var(--text-faint)" : delta > 0 ? "var(--over)" : "var(--under)";
          return (
            <tr key={row.label} className="align-middle">
              <td className="w-[38%] py-1.5 pr-3 text-[12.5px] text-[var(--text-muted)]">{row.label}</td>
              <td className="py-1.5">
                <div className="relative h-[16px] w-full rounded-[3px] bg-[var(--surface-2)]">
                  <div
                    className="absolute inset-y-0 left-0 rounded-[3px]"
                    style={{ width: `${(row.current / max) * 100}%`, background: material ? tone : "var(--chart-8)" }}
                  />
                  <div
                    className="absolute inset-y-[-3px] w-[2px] bg-[var(--text)]"
                    style={{ left: `calc(${(row.reference / max) * 100}% - 1px)` }}
                    title={`Reference ${formatPercent(row.reference)}`}
                  />
                </div>
              </td>
              <td className="tnum w-[62px] py-1.5 pl-3 text-right text-[12.5px] font-medium">{formatPercent(row.current)}</td>
              <td className="tnum w-[68px] py-1.5 pl-2 text-right text-[12px]" style={{ color: tone }}>
                {formatPp(delta)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** A 0-100 composite score with its scale made visible. */
export function ScoreMeter({ label, score, detail }: { label: string; score: number; detail?: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] text-[var(--text-muted)]">{label}</span>
        <span className="tnum text-[15px] font-semibold text-[var(--text)]">{score}</span>
      </div>
      <div className="mt-1.5 h-[6px] w-full overflow-hidden rounded-full bg-[var(--surface-3)]">
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: "var(--accent)" }} />
      </div>
      {detail ? <p className="mt-1.5 text-[11.5px] leading-snug text-[var(--text-muted)]">{detail}</p> : null}
    </div>
  );
}

/** Small inline bar for table cells, where a number alone is hard to scan. */
export function MiniBar({ value, max, tone = "var(--accent)" }: { value: number; max: number; tone?: string }) {
  const width = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="h-[5px] w-full rounded-full bg-[var(--surface-3)]">
      <div className="h-full rounded-full" style={{ width: `${width}%`, background: tone }} />
    </div>
  );
}

export { PALETTE };
