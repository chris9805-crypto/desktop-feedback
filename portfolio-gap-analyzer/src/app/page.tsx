"use client";

import { useMemo, useState } from "react";
import { FeeGapChart, RangeChart } from "@/components/PrimerCharts";
import { RiskPicker } from "@/components/RiskPicker";
import { StartButtons } from "@/components/StartButtons";
import { Callout, Card, inlineInputClass } from "@/components/ui";
import { DATASET_META } from "@/lib/data/dataset-meta";
import { feeIllustration, forecastAnswer, goalAnswer, type RiskTolerance } from "@/lib/engine/primer";
import { formatCurrency, formatPercent } from "@/lib/format";
import { useStore } from "@/lib/state/store";

/**
 * The opening page, in two directions.
 *
 * Both are the same arithmetic read from opposite ends — "I want this much,
 * what does it take?" and "here is what I can do, where does it get me?" — and
 * which one a reader wants depends entirely on whether they already have a
 * number in mind. Guessing wrong makes the page feel like it is asking the
 * wrong question, so it asks which.
 */

/** A sentence with its inputs on the line, stacking on a narrow screen. */
function Line({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 text-[15px] text-[var(--text)]">{children}</div>;
}

function Amount({
  value,
  onChange,
  step = 1000,
  width = "w-32",
}: {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  width?: string;
}) {
  return (
    <input
      className={`${inlineInputClass} ${width}`}
      type="number"
      min={0}
      step={step}
      value={value}
      onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
    />
  );
}

function Years({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <select
      className={`${inlineInputClass} w-[4.5rem]`}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
    >
      {Array.from({ length: 43 }, (_, index) => index + 3).map((year) => (
        <option key={year} value={year}>
          {year}
        </option>
      ))}
    </select>
  );
}

/** The answer, as one number with its units spelled out. */
function Answer({ eyebrow, value, detail }: { eyebrow: string; value: string; detail: string }) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-5 py-5">
      <div className="text-[11.5px] uppercase tracking-wide text-[var(--accent-text)]">{eyebrow}</div>
      <div className="tnum mt-1.5 text-[30px] font-semibold leading-none text-[var(--text)] sm:text-[34px]">{value}</div>
      <p className="mt-2.5 text-[13px] leading-relaxed text-[var(--text-muted)]">{detail}</p>
    </div>
  );
}

function Fact({ label, value, children }: { label: string; value: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">{label}</div>
      <div className="tnum mt-1 text-[18px] font-semibold text-[var(--text)]">{value}</div>
      <p className="mt-1.5 text-[12px] leading-snug text-[var(--text-muted)]">{children}</p>
    </Card>
  );
}

export default function HomePage() {
  const { state, setPrimer, setProfile } = useStore();
  const { mode, goal, years, startingAmount, monthly } = state.primer;
  const tolerance = state.profile.riskTolerance;
  const currency = state.profile.baseCurrency;
  const [showDetail, setShowDetail] = useState(false);

  const plan = useMemo(
    () =>
      mode === "goal"
        ? goalAnswer({ goal, years, startingAmount, tolerance })
        : forecastAnswer({ monthly, years, startingAmount, tolerance }),
    [mode, goal, years, startingAmount, monthly, tolerance],
  );

  // The fee chart follows whatever payment the chosen mode settled on.
  const payment = plan.mode === "goal" ? plan.monthly : plan.monthly;
  const fees = useMemo(
    () =>
      feeIllustration({
        amount: startingAmount,
        monthlyContribution: payment,
        years,
        growth: plan.mix.realReturn,
        lowCharge: plan.lowCharge,
        highCharge: plan.highCharge,
      }),
    [startingAmount, payment, years, plan.mix.realReturn, plan.lowCharge, plan.highCharge],
  );

  const money = (value: number) => formatCurrency(value, currency);
  /**
   * Simulated outcomes carry no precision worth printing. "$55,264" invites a
   * reader to believe the last three digits; "$55,300" says the same thing
   * without the false promise.
   */
  const roughly = (value: number) => money(Math.round(value / (value >= 10000 ? 100 : 10)) * (value >= 10000 ? 100 : 10));

  const modes = [
    { id: "goal" as const, label: "I have a target", hint: "Work out what it takes" },
    { id: "forecast" as const, label: "I have a plan", hint: "Work out where it gets me" },
  ];

  return (
    <div className="space-y-10">
      <section className="pt-3">
        <p className="text-[12px] font-medium uppercase tracking-wider text-[var(--accent-text)]">
          Research and education for stock and ETF investors
        </p>
        <h1 className="mt-3 max-w-2xl text-[30px] font-semibold leading-[1.15] tracking-tight text-[var(--text)] sm:text-[36px]">
          Answer three questions. Get one number.
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--text-muted)]">
          No jargon and nothing to buy. Start from a target you have in mind, or from what you can already put aside.
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        {modes.map((option) => {
          const active = option.id === mode;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              onClick={() => setPrimer({ mode: option.id })}
              className={`card px-5 py-4 text-left transition-colors ${
                active ? "border-[var(--accent)] bg-[var(--accent-soft)]" : "hover:bg-[var(--surface-2)]"
              }`}
            >
              <div className={`text-[15px] font-semibold ${active ? "text-[var(--accent-text)]" : "text-[var(--text)]"}`}>
                {option.label}
              </div>
              <div className="mt-0.5 text-[12.5px] text-[var(--text-muted)]">{option.hint}</div>
            </button>
          );
        })}
      </div>

      <Card className="divide-y divide-[var(--border)]">
        <div className="px-5 py-4">
          <Line>
            <span>I have</span>
            <Amount value={startingAmount} onChange={(value) => setPrimer({ startingAmount: value })} />
            {mode === "forecast" ? (
              <>
                <span>today, and can add</span>
                <Amount value={monthly} onChange={(value) => setPrimer({ monthly: value })} step={50} width="w-28" />
                <span>a month.</span>
              </>
            ) : (
              <span>today.</span>
            )}
          </Line>
        </div>

        <div className="px-5 py-4">
          {mode === "goal" ? (
            <Line>
              <span>In</span>
              <Years value={years} onChange={(value) => setPrimer({ years: value })} />
              <span>years I want to have</span>
              <Amount value={goal} onChange={(value) => setPrimer({ goal: value })} step={10000} />
            </Line>
          ) : (
            <Line>
              <span>Show me what I would have in</span>
              <Years value={years} onChange={(value) => setPrimer({ years: value })} />
              <span>years.</span>
            </Line>
          )}
        </div>

        <div className="px-5 py-4">
          <div className="mb-3 text-[15px] text-[var(--text)]">I am comfortable with this much movement:</div>
          <RiskPicker value={tolerance} onChange={(value) => setProfile({ riskTolerance: value as RiskTolerance })} />
        </div>
      </Card>

      <section className="space-y-4">
        {plan.mode === "goal" ? (
          plan.alreadyThere ? (
            <Callout title="You are already there" tone="accent">
              On these assumptions {money(startingAmount)} grows past {money(plan.goal)} within {years} years on its
              own. Try a bigger target, fewer years, or a smaller starting sum.
            </Callout>
          ) : (
            <Answer
              eyebrow={`To reach ${money(plan.goal)} in ${years} years`}
              value={`${money(plan.monthly)} a month`}
              detail={`Held in a ${plan.mix.label.toLowerCase()} mix — about ${Math.round(
                plan.mix.equityShare * 100,
              )}% shares — in a fund charging ${formatPercent(plan.lowCharge, 2)} a year. You would pay in ${money(
                plan.contributed,
              )} altogether, and the investment is expected to make up the rest.`}
            />
          )
        ) : (
          <Answer
            eyebrow={`In ${years} years, on these assumptions`}
            value={`${roughly(plan.p10)} to ${roughly(plan.p90)}`}
            detail={`Middle outcome ${roughly(plan.p50)}, against ${money(
              plan.contributed,
            )} paid in. Held in a ${plan.mix.label.toLowerCase()} mix — about ${Math.round(
              plan.mix.equityShare * 100,
            )}% shares — in a fund charging ${formatPercent(plan.lowCharge, 2)} a year. In today's money.`}
          />
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          {plan.mode === "goal" ? (
            <>
              <Fact label="In a bad run you land near" value={roughly(plan.p10)}>
                One run in ten did worse than that. {formatPercent(plan.shortfall, 0)} of runs finished below{" "}
                {money(plan.goal)} — a payment sized on an average return is roughly a coin flip.
              </Fact>
              <Fact label="In a dear fund instead" value={`${money(plan.monthlyHighCharge)} a month`}>
                At {formatPercent(plan.highCharge, 2)} a year rather than {formatPercent(plan.lowCharge, 2)}. That is{" "}
                {money(plan.monthlyExtra)} more every month, {money(plan.feeCostOverTerm)} over {years} years.
              </Fact>
              <Fact label="Or keep paying the same" value={`${roughly(plan.shortBy)} short`}>
                Pay {money(plan.monthly)} into the dearer fund and you land at {roughly(plan.highChargeOutcome)} instead
                of {money(plan.goal)}.
              </Fact>
            </>
          ) : (
            <>
              <Fact label="You would have paid in" value={money(plan.contributed)}>
                {money(startingAmount)} to start plus {money(monthly)} a month.{" "}
                {formatPercent(plan.belowContributed, 0)} of runs finished below that — investing can lose money.
              </Fact>
              <Fact label="In a dear fund instead" value={roughly(plan.dear.p50)}>
                The same payments at {formatPercent(plan.highCharge, 2)} a year rather than{" "}
                {formatPercent(plan.lowCharge, 2)}, as a middle outcome.
              </Fact>
              <Fact label="So the charge costs" value={roughly(plan.feeCost)}>
                {formatPercent(plan.feeShare, 0)} of the middle outcome, for an identical plan held in a dearer fund.
              </Fact>
            </>
          )}
        </div>

        <Card className="p-5">
          <h2 className="text-[14px] font-semibold text-[var(--text)]">If you could live with more, or less, movement</h2>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--text-muted)]">
            The same question at every setting.{" "}
            {plan.mode === "goal"
              ? "More in shares asks less of you each month — and lands lower in a bad run."
              : "More in shares lifts the middle outcome — and lowers the bad run."}{" "}
            Nothing here says which row is right for you; that depends on when you need the money.
          </p>
          <ul className="mt-4 space-y-2">
            {plan.alternatives.map((option, index) => (
              <li
                key={option.tolerance}
                className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-lg px-3 py-2 ${
                  option.chosen ? "bg-[var(--accent-soft)]" : ""
                }`}
              >
                <span className="flex items-center gap-2.5 text-[13px]">
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]"
                    style={{ background: `var(--chart-${index + 1})` }}
                    aria-hidden="true"
                  />
                  <span className={option.chosen ? "font-semibold text-[var(--text)]" : "text-[var(--text-muted)]"}>
                    {option.label}
                  </span>
                  <span className="text-[11.5px] text-[var(--text-faint)]">
                    {Math.round(option.equityShare * 100)}% shares
                  </span>
                </span>
                <span className="tnum text-[13px] text-[var(--text-muted)]">
                  {option.monthly !== null ? (
                    <>
                      <span className="font-semibold text-[var(--text)]">{money(option.monthly)}</span> a month
                    </>
                  ) : (
                    <>
                      middle <span className="font-semibold text-[var(--text)]">{roughly(option.p50)}</span>
                    </>
                  )}
                  <span className="ml-3 text-[var(--text-faint)]">bad run {roughly(option.p10)}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <Callout title="Read this as a direction, not a plan">
          Every figure here is arithmetic on long-run averages, in today&apos;s money, on a {formatPercent(
            plan.mix.realReturn,
            1,
          )}{" "}
          return before charges. Real returns do not arrive evenly — a {plan.mix.label.toLowerCase()} mix has had years
          down around {formatPercent(Math.abs(plan.mix.roughBadYear), 0)}. The comparison between settings is the useful
          part, not any single number.
        </Callout>

        <div>
          <button
            type="button"
            onClick={() => setShowDetail((value) => !value)}
            aria-expanded={showDetail}
            className="text-[13px] font-medium text-[var(--accent-text)] hover:underline"
          >
            {showDetail ? "Hide the detail ↑" : "Show the detail behind these numbers ↓"}
          </button>
        </div>

        {showDetail ? (
          <div className="space-y-5">
            <Card className="p-5">
              <h3 className="text-[14px] font-semibold text-[var(--text)]">Where each setting actually lands</h3>
              <p className="mb-4 mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-[var(--text-muted)]">
                Each setting run 2,000 times.{" "}
                {plan.mode === "goal"
                  ? `Each one pays its own monthly figure, and the line is the ${money(plan.goal)} target.`
                  : `All paying the same ${money(monthly)} a month, and the line is the ${money(
                      plan.contributed,
                    )} paid in.`}
              </p>
              <RangeChart
                bands={plan.alternatives}
                currency={currency}
                marker={plan.mode === "goal" ? plan.goal : plan.contributed}
                markerLabel={plan.mode === "goal" ? "target" : "paid in"}
              />
            </Card>
            <Card className="p-5">
              <h3 className="text-[14px] font-semibold text-[var(--text)]">
                The same {money(payment)} a month, under both charges
              </h3>
              <p className="mb-4 mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-[var(--text-muted)]">
                Identical payments and identical returns. The shaded wedge is the charge, and it widens because each
                year&apos;s charge also gives up what that money would have earned afterwards.
              </p>
              <FeeGapChart points={fees.points} currency={currency} difference={fees.difference} />
            </Card>
          </div>
        ) : null}
      </section>

      <section>
        <h2 className="text-[20px] font-semibold tracking-tight text-[var(--text)]">Then, which holdings</h2>
        <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-[var(--text-muted)]">
          Once the mix and the cost are settled, the rest is checking what you own against them. Gapline builds a
          reference from your answers, compares your holdings with it, and shows the arithmetic behind every difference.
        </p>
        <div className="mt-5">
          <StartButtons />
        </div>
        <p className="mt-4 text-[12px] text-[var(--text-faint)]">
          Runs entirely in your browser. Your holdings are never sent anywhere.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-[14px] font-semibold text-[var(--text)]">Not an adviser</h3>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-muted)]">
            Personal investment advice requires a licence. This tool has none and pretends to none. It describes,
            compares and explains, and shows the filter criteria behind every instrument list.
          </p>
        </Card>
        <Card className="p-5">
          <h3 className="text-[14px] font-semibold text-[var(--text)]">Not a forecast</h3>
          <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-muted)]">
            The figures above are long-run averages run through a simulation, not a view on what happens next. No price
            targets, no ratings. Assumed rates are labelled wherever they are used.
          </p>
        </Card>
      </section>

      <Callout tone="warn" title="About the data in this build">
        {DATASET_META.warning} The dataset is dated {DATASET_META.asOf}.
      </Callout>
    </div>
  );
}
