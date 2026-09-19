"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DisclaimerFooter } from "@/components/Disclaimer";
import { Term } from "@/components/Term";
import { Button, Callout, Card, Pill, SectionHeading } from "@/components/ui";
import { THEMES, matchesFor, themeById } from "@/lib/engine/themes";
import { themeImpact } from "@/lib/engine/theme-impact";
import type { Security } from "@/lib/engine/types";
import { formatCurrency, formatPercent, formatPp, label } from "@/lib/format";
import { useStore } from "@/lib/state/store";

const SLEEVE_STEPS = [0.02, 0.05, 0.1, 0.15, 0.2];

function yieldOf(s: Security): number {
  return s.kind === "etf" ? s.yield : s.fundamentals.dividendYield;
}

/** The number the theme actually ranked on, so the ordering is legible. */
function rankLine(themeId: string, s: Security): string {
  if (themeId === "dividend-growers") {
    return s.kind === "stock" ? `${s.fundamentals.dividendGrowthStreakYears}y of rises` : "Index rule";
  }
  if (themeId === "quality-compounders") {
    return s.kind === "stock" ? `${formatPercent(s.fundamentals.returnOnInvestedCapital)} ROIC` : "Index rule";
  }
  if (themeId === "cybersecurity") {
    return s.kind === "stock" ? `${formatPercent(s.fundamentals.revenueCagr3y)} revenue growth` : "Index rule";
  }
  if (themeId === "defensive-income") return `${formatPercent(yieldOf(s))} yield`;
  return `${formatPercent(s.trailing.return12m, 1)} over 12m`;
}

function MatchRow({
  security,
  themeId,
  picked,
  onToggle,
}: {
  security: Security;
  themeId: string;
  picked: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 border-b border-[var(--border)] px-4 py-3 last:border-b-0 ${
        picked ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--surface-2)]"
      }`}
    >
      <input
        type="checkbox"
        checked={picked}
        onChange={onToggle}
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-[13.5px] font-semibold text-[var(--text)]">{security.symbol}</span>
          <span className="truncate text-[12.5px] text-[var(--text-muted)]">{security.name}</span>
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[var(--text-faint)]">
          <span className="tnum">{rankLine(themeId, security)}</span>
          {security.kind === "etf" ? (
            <span className="tnum">{formatPercent(security.fund.expenseRatio, 2)} charge</span>
          ) : (
            <span>{label(security.sector)}</span>
          )}
          <Link
            href={`/research/${security.symbol}`}
            className="text-[var(--accent-text)] hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            Details
          </Link>
        </span>
      </span>
    </label>
  );
}

function Delta({
  label: name,
  before,
  after,
  format,
  worseWhenUp = true,
}: {
  label: string;
  before: number;
  after: number;
  format: (value: number) => string;
  worseWhenUp?: boolean;
}) {
  const delta = after - before;
  const flat = Math.abs(delta) < 1e-9;
  const worse = worseWhenUp ? delta > 0 : delta < 0;
  const colour = flat ? "var(--text-muted)" : worse ? "var(--over)" : "var(--under)";
  return (
    <div className="px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">{name}</div>
      <div className="tnum mt-1 flex items-baseline gap-2">
        <span className="text-[13px] text-[var(--text-faint)] line-through">{format(before)}</span>
        <span className="text-[17px] font-semibold leading-none" style={{ color: colour }}>
          {format(after)}
        </span>
      </div>
    </div>
  );
}

export default function ThemesPage() {
  const { state, report, hasHoldings, setHoldings } = useStore();
  const [themeId, setThemeId] = useState<string>(THEMES[0]!.id);
  const [picked, setPicked] = useState<string[]>([]);
  const [share, setShare] = useState(0.05);
  const [saved, setSaved] = useState(false);

  const theme = themeById(themeId) ?? THEMES[0]!;
  const matches = useMemo(() => matchesFor(theme), [theme]);

  const impact = useMemo(
    () =>
      themeImpact({
        holdings: state.holdings,
        cash: state.cash,
        totalValueHint: state.totalValueHint,
        profile: state.profile,
        referenceOverrides: state.referenceOverrides,
        sleeve: { symbols: picked, share },
      }),
    [state.holdings, state.cash, state.totalValueHint, state.profile, state.referenceOverrides, picked, share],
  );

  const invested = report.portfolio.positions.reduce((total, position) => total + position.value, 0);
  const currency = state.profile.baseCurrency;

  const toggle = (symbol: string) => {
    setSaved(false);
    setPicked((current) => (current.includes(symbol) ? current.filter((s) => s !== symbol) : [...current, symbol]));
  };

  const selectTheme = (id: string) => {
    setThemeId(id);
    setPicked([]);
    setSaved(false);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--text)]">Themes</h1>
        <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-[var(--text-muted)]">
          Build a sleeve around an idea — then see what it does to the rest of your portfolio. Every theme here is a{" "}
          <strong className="font-semibold text-[var(--text)]">rule</strong>, printed next to its results, not a list
          somebody picked.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {THEMES.map((option) => {
          const active = option.id === theme.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => selectTheme(option.id)}
              aria-pressed={active}
              className={`card px-4 py-3.5 text-left transition-colors ${
                active ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "hover:bg-[var(--surface-2)]"
              }`}
            >
              <div className="text-[13.5px] font-semibold text-[var(--text)]">{option.label}</div>
              <p className="mt-1 text-[12px] leading-snug text-[var(--text-muted)]">{option.blurb}</p>
            </button>
          );
        })}
      </div>

      <Card className="p-5">
        <SectionHeading title={`The rule behind ${theme.label}`} />
        <p className="text-[13px] leading-relaxed text-[var(--text)]">{theme.criteria}</p>
        <div className="mt-4">
          <Callout title="The case against" tone="warn">
            {theme.caution}
          </Callout>
        </div>
      </Card>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Card>
          <div className="flex items-baseline justify-between border-b border-[var(--border)] px-4 py-3">
            <h2 className="text-[13.5px] font-semibold text-[var(--text)]">
              Funds <span className="font-normal text-[var(--text-muted)]">({matches.funds.length})</span>
            </h2>
            <span className="text-[11.5px] text-[var(--text-faint)]">One line, many companies</span>
          </div>
          {matches.funds.length === 0 ? (
            <p className="px-4 py-8 text-center text-[12.5px] text-[var(--text-muted)]">
              No fund in the bundled universe passes this rule.
            </p>
          ) : (
            matches.funds.map((security) => (
              <MatchRow
                key={security.symbol}
                security={security}
                themeId={theme.id}
                picked={picked.includes(security.symbol)}
                onToggle={() => toggle(security.symbol)}
              />
            ))
          )}
        </Card>

        <Card>
          <div className="flex items-baseline justify-between border-b border-[var(--border)] px-4 py-3">
            <h2 className="text-[13.5px] font-semibold text-[var(--text)]">
              Companies <span className="font-normal text-[var(--text-muted)]">({matches.stocks.length})</span>
            </h2>
            <span className="text-[11.5px] text-[var(--text-faint)]">One line, one business</span>
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            {matches.stocks.map((security) => (
              <MatchRow
                key={security.symbol}
                security={security}
                themeId={theme.id}
                picked={picked.includes(security.symbol)}
                onToggle={() => toggle(security.symbol)}
              />
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <SectionHeading
          title="Sleeve size"
          description="Modelled as funded out of everything you already hold, scaled down evenly. Cash is left alone."
        />
        <div className="flex flex-wrap items-center gap-2">
          {SLEEVE_STEPS.map((step) => (
            <button
              key={step}
              type="button"
              onClick={() => { setShare(step); setSaved(false); }}
              aria-pressed={share === step}
              className={`tnum rounded-lg border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                share === step
                  ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-text)]"
                  : "border-[var(--border-strong)] text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
              }`}
            >
              {formatPercent(step, 0)}
            </button>
          ))}
          {invested > 0 ? (
            <span className="tnum ml-auto text-[12.5px] text-[var(--text-muted)]">
              {formatCurrency(invested * share, currency)} of {formatCurrency(invested, currency)}
              {picked.length > 1 ? ` · ${formatCurrency((invested * share) / picked.length, currency)} each` : ""}
            </span>
          ) : null}
        </div>
      </Card>

      {!hasHoldings ? (
        <Callout title="Add your holdings to see the other half of this" tone="accent">
          A theme on its own is just a list. The point of building one here is the line below it —{" "}
          <Link href="/portfolio" className="font-medium text-[var(--accent-text)] hover:underline">
            enter what you hold
          </Link>{" "}
          and this page shows what the sleeve does to your <Term k="concentration">concentration</Term>, sector mix and
          charges.
        </Callout>
      ) : picked.length === 0 ? (
        saved ? (
          <Callout title="Saved — your holdings now include the sleeve" tone="accent">
            Every other tab reflects it, and the Holdings tab is where to edit or undo it.{" "}
            <Link href="/analysis" className="font-medium text-[var(--accent-text)] hover:underline">
              Open the full gap report
            </Link>
            . Picking again starts from the portfolio you now hold.
          </Callout>
        ) : (
          <Callout title="Pick a name or two above">
            Tick anything on either list and this page shows what that sleeve does to your existing gap report.
          </Callout>
        )
      ) : (
        <Card>
          <div className="border-b border-[var(--border)] px-5 py-3.5">
            <h2 className="text-[15px] font-semibold tracking-tight text-[var(--text)]">
              What a {formatPercent(share, 0)} {theme.label} sleeve does to your portfolio
            </h2>
            <p className="mt-1 text-[12.5px] text-[var(--text-muted)]">
              {picked.length} name{picked.length === 1 ? "" : "s"}, split evenly: {picked.join(", ")}
            </p>
          </div>

          <div className="grid grid-cols-2 divide-x divide-y divide-[var(--border)] lg:grid-cols-4 [&>*]:border-[var(--border)]">
            <Delta
              label="Top 10 names"
              before={impact.before.topTenWeight}
              after={impact.after.topTenWeight}
              format={(v) => formatPercent(v)}
            />
            <Delta
              label="Effective names"
              before={impact.before.effectiveNames}
              after={impact.after.effectiveNames}
              format={(v) => v.toFixed(0)}
              worseWhenUp={false}
            />
            <Delta
              label="Ongoing charge"
              before={impact.before.expenseRatio}
              after={impact.after.expenseRatio}
              format={(v) => formatPercent(v, 2)}
            />
            <Delta
              label="Modelled volatility"
              before={impact.before.estimatedVolatility}
              after={impact.after.estimatedVolatility}
              format={(v) => formatPercent(v)}
            />
          </div>

          <div className="space-y-5 px-5 py-4">
            {impact.sectorShifts.length > 0 ? (
              <div>
                <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
                  Sector shift
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {impact.sectorShifts.slice(0, 4).map((shift) => (
                    <li key={shift.sector} className="flex items-baseline justify-between gap-3 text-[13px]">
                      <span className="text-[var(--text)]">{label(shift.sector)}</span>
                      <span className="tnum text-[var(--text-muted)]">
                        {formatPercent(shift.before)} → {formatPercent(shift.after)}{" "}
                        <span style={{ color: shift.delta > 0 ? "var(--over)" : "var(--under)" }}>
                          ({formatPp(shift.delta)})
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
                  New gaps flagged
                </h3>
                {impact.added.length === 0 ? (
                  <p className="mt-2 text-[12.5px] text-[var(--text-muted)]">
                    Nothing new at this size. A bigger sleeve may change that.
                  </p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {impact.added.map((finding) => (
                      <li key={finding.id} className="text-[12.5px] leading-snug">
                        <Pill tone="over">New</Pill>{" "}
                        <span className="text-[var(--text)]">{finding.title}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
                  Gaps no longer flagged
                </h3>
                {impact.resolved.length === 0 ? (
                  <p className="mt-2 text-[12.5px] text-[var(--text-muted)]">None.</p>
                ) : (
                  <>
                    <ul className="mt-2 space-y-1.5">
                      {impact.resolved.map((finding) => (
                        <li key={finding.id} className="text-[12.5px] leading-snug">
                          <Pill tone="under">Cleared</Pill>{" "}
                          <span className="text-[var(--text)]">{finding.title}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-[11.5px] leading-snug text-[var(--text-faint)]">
                      A gap can drop off this list because the sleeve shrank the part of the portfolio it was about, not
                      because anything was fixed.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] px-5 py-4">
            <Button
              onClick={() => {
                setHoldings(impact.holdings);
                setPicked([]);
                setSaved(true);
              }}
            >
              Model this in my holdings
            </Button>
            <Button variant="secondary" href="/analysis">
              Open the full gap report
            </Button>
            <span className="text-[12.5px] text-[var(--text-faint)]">
              Writes the sleeve into your saved holdings so every other tab reflects it. Nothing leaves your device.
            </span>
          </div>
        </Card>
      )}

      <DisclaimerFooter />
    </div>
  );
}
