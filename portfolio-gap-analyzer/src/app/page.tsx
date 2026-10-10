"use client";

import { useMemo, useState } from "react";
import { FeeGapChart, RangeChart } from "@/components/PrimerCharts";
import { StartButtons } from "@/components/StartButtons";
import { Callout, Card, Field, inputClass } from "@/components/ui";
import { DATASET_META } from "@/lib/data/dataset-meta";
import { feeIllustration, goalPlan } from "@/lib/engine/primer";
import { formatCurrency, formatPercent } from "@/lib/format";
import { useStore } from "@/lib/state/store";

/**
 * The first screen: one question, worked backwards.
 *
 * An earlier version of this page put two illustrations side by side — what a
 * share/bond split does to the range, and what a charge costs over time — and
 * asked the reader to hold both at once before they had a reason to care about
 * either. Starting from a goal collapses them into a single answer: the monthly
 * payment falls as the share in shares rises, and rises again with the charge.
 * Same two lessons, one table, and a question someone with no background can
 * answer about themselves.
 */
export default function HomePage() {
  const { state, setPrimer } = useStore();
  const { goal, years, startingAmount } = state.primer;
  const currency = state.profile.baseCurrency;
  const [showDetail, setShowDetail] = useState(false);

  const plan = useMemo(() => goalPlan({ goal, years, startingAmount }), [goal, years, startingAmount]);
  // The fee chart follows the plan that needs the least each month: same
  // payment, two charges, so the gap is the charge and nothing else.
  const lead = plan.leastPerMonth;
  const fees = useMemo(
    () =>
      feeIllustration({
        amount: startingAmount,
        monthlyContribution: lead.monthly,
        years,
        growth: lead.realReturn,
        lowCharge: plan.lowCharge,
        highCharge: plan.highCharge,
      }),
    [startingAmount, lead.monthly, lead.realReturn, years, plan.lowCharge, plan.highCharge],
  );

  const money = (value: number) => formatCurrency(value, currency);
  /**
   * Simulated outcomes carry no precision worth printing. "$55,264" invites a
   * reader to believe the last three digits; "$55,300" says the same thing
   * without the false promise.
   */
  const roughly = (value: number) => {
    const step = value >= 10000 ? 100 : 10;
    return money(Math.round(value / step) * step);
  };
  const shortBy = plan.goal - lead.highChargeOutcome;
  const everyoneThere = plan.mixes.every((mix) => mix.alreadyThere);

  return (
    <div className="space-y-10">
      <section className="pt-3">
        <p className="text-[12px] font-medium uppercase tracking-wider text-[var(--accent-text)]">
          Research and education for stock and ETF investors
        </p>
        <h1 className="mt-3 max-w-2xl text-[30px] font-semibold leading-[1.15] tracking-tight text-[var(--text)] sm:text-[36px]">
          Start with what you want, not with what to buy.
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--text-muted)]">
          Tell it the number you have in mind. It works backwards to what that takes each month — and shows the two
          things that change the answer most.
        </p>
      </section>

      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="I want to have">
            <input
              className={inputClass}
              type="number"
              min={0}
              step={10000}
              value={goal}
              onChange={(event) => setPrimer({ goal: Math.max(0, Number(event.target.value) || 0) })}
            />
          </Field>
          <Field label={`In ${years} years`}>
            <input
              type="range"
              min={3}
              max={45}
              step={1}
              value={years}
              onChange={(event) => setPrimer({ years: Number(event.target.value) })}
              className="mt-2 w-full accent-[var(--accent)]"
            />
          </Field>
          <Field label="Starting with">
            <input
              className={inputClass}
              type="number"
              min={0}
              step={1000}
              value={startingAmount}
              onChange={(event) => setPrimer({ startingAmount: Math.max(0, Number(event.target.value) || 0) })}
            />
          </Field>
        </div>
      </Card>

      <section>
        <h2 className="text-[20px] font-semibold tracking-tight text-[var(--text)]">
          What it takes to get to {money(plan.goal)}
        </h2>
        <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-[var(--text-muted)]">
          The answer depends on how much of your money sits in shares. Shares have paid more than bonds over long
          periods, so they ask less of you each month — and move far more along the way.
        </p>

        {everyoneThere ? (
          <Callout title="You are already there" tone="accent">
            On these assumptions {money(startingAmount)} grows past {money(plan.goal)} within {years} years on its own,
            whichever mix it sits in. Try a bigger number, a shorter time, or a smaller starting sum.
          </Callout>
        ) : (
          <Card className="mt-5 overflow-hidden">
            {/* Not a <table>: at phone width three columns squeezed the labels
                into six-line wraps. The rows stack instead, and each figure
                carries its own caption once the header row is gone. */}
            <div className="hidden border-b border-[var(--border)] px-5 py-3 text-[11px] uppercase tracking-wide text-[var(--text-faint)] sm:flex">
              <span className="flex-1">How it is invested</span>
              <span className="w-36 text-right">Put aside each month</span>
              <span className="w-44 text-right">In a bad run, you land near</span>
            </div>
            <ul className="divide-y divide-[var(--border)]">
              {plan.mixes.map((mix, index) => (
                <li key={mix.id} className="px-5 py-3.5 sm:flex sm:items-center">
                  <div className="flex-1">
                    <span className="flex items-center gap-2.5 text-[14px] font-medium text-[var(--text)]">
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-[3px]"
                        style={{ background: `var(--chart-${index + 1})` }}
                        aria-hidden="true"
                      />
                      {mix.label}
                    </span>
                    <span className="mt-0.5 block pl-5 text-[11.5px] text-[var(--text-faint)]">
                      has grown {formatPercent(mix.realReturn, 1)} a year above inflation
                    </span>
                  </div>
                  <div className="mt-2.5 flex items-baseline gap-8 pl-5 sm:mt-0 sm:gap-0 sm:pl-0">
                    <div className="sm:w-36 sm:text-right">
                      <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)] sm:hidden">
                        Each month
                      </div>
                      <div className="tnum text-[18px] font-semibold text-[var(--text)]">
                        {mix.alreadyThere ? "nothing" : money(mix.monthly)}
                      </div>
                    </div>
                    <div className="sm:w-44 sm:text-right">
                      <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)] sm:hidden">
                        In a bad run
                      </div>
                      <div className="tnum text-[14px] text-[var(--text-muted)]">{roughly(mix.p10)}</div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <p className="border-t border-[var(--border)] px-5 py-3 text-[11.5px] leading-relaxed text-[var(--text-faint)]">
              &ldquo;A bad run&rdquo; is the 10th percentile of 2,000 simulated runs: one run in ten did worse than
              that. Figures are in today&apos;s money and rounded.
            </p>
          </Card>
        )}

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Callout title="Why the monthly figure falls" tone="accent">
            {money(plan.mostPerMonth.monthly)} a month with {plan.mostPerMonth.label.toLowerCase()},{" "}
            {money(lead.monthly)} with {lead.label.toLowerCase()}. More in shares means the money is expected to do more
            of the work, so less has to come from you.
          </Callout>
          <Callout title="Why that is not simply better" tone="warn">
            The last column is the catch. In a poor run {lead.label.toLowerCase()} lands near {roughly(lead.p10)}, against{" "}
            {roughly(plan.mostPerMonth.p10)} for {plan.mostPerMonth.label.toLowerCase()} — so the plan that asks least of
            you is also the one that can miss by most.
          </Callout>
        </div>

        <Card className="mt-4 p-5">
          <h3 className="text-[14px] font-semibold text-[var(--text)]">
            And all of that assumed a cheap fund. Here is what a dear one does.
          </h3>
          <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-[var(--text-muted)]">
            Every figure above assumes you pay {formatPercent(plan.lowCharge, 2)} a year to hold the investment. Plenty
            of products charge {formatPercent(plan.highCharge, 2)}. The money comes out of the same pot, every year, so
            the goal needs more from you.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">Same plan, dearer fund</div>
              <div className="tnum mt-1 text-[19px] font-semibold text-[var(--over)]">
                {money(lead.monthlyHighCharge)} a month
              </div>
              <p className="mt-1.5 text-[12px] leading-snug text-[var(--text-muted)]">
                instead of {money(lead.monthly)}, to reach the same {money(plan.goal)} with{" "}
                {lead.label.toLowerCase()}.
              </p>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">Over {years} years</div>
              <div className="tnum mt-1 text-[19px] font-semibold text-[var(--over)]">{money(plan.feeCostOverTerm)}</div>
              <p className="mt-1.5 text-[12px] leading-snug text-[var(--text-muted)]">
                extra out of your own pocket, for the same goal and the same mix.
              </p>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">Or, if you do not add it</div>
              <div className="tnum mt-1 text-[19px] font-semibold text-[var(--over)]">
                {roughly(shortBy)} short
              </div>
              <p className="mt-1.5 text-[12px] leading-snug text-[var(--text-muted)]">
                Keep paying {money(lead.monthly)} and the dearer charge leaves you at {roughly(lead.highChargeOutcome)}.
              </p>
            </div>
          </div>
        </Card>

        <Callout title="Read these as a direction, not a plan">
          Every figure here is arithmetic on long-run averages, in today&apos;s money. Real returns do not arrive
          evenly, and a plan sized on an average lands under it about half the time — on these assumptions,{" "}
          {formatPercent(lead.shortfall, 0)} of simulated runs for {lead.label.toLowerCase()} finished below{" "}
          {money(plan.goal)}. The point is the comparison between the rows, not any one number.
        </Callout>

        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowDetail((value) => !value)}
            aria-expanded={showDetail}
            className="text-[13px] font-medium text-[var(--accent-text)] hover:underline"
          >
            {showDetail ? "Hide the detail" : "Show the detail behind these numbers"} {showDetail ? "↑" : "↓"}
          </button>
        </div>

        {showDetail ? (
          <div className="mt-4 space-y-5">
            <Card className="p-5">
              <h3 className="text-[14px] font-semibold text-[var(--text)]">Where each plan actually lands</h3>
              <p className="mt-1.5 mb-4 max-w-2xl text-[12.5px] leading-relaxed text-[var(--text-muted)]">
                Each mix paying its own monthly figure, run 2,000 times. The line is the {money(plan.goal)} goal.
              </p>
              <RangeChart bands={plan.mixes} currency={currency} marker={plan.goal} markerLabel="goal" />
            </Card>
            <Card className="p-5">
              <h3 className="text-[14px] font-semibold text-[var(--text)]">
                The same {money(lead.monthly)} a month, under both charges
              </h3>
              <p className="mt-1.5 mb-4 max-w-2xl text-[12.5px] leading-relaxed text-[var(--text-muted)]">
                Identical payments and identical returns. The shaded wedge is the charge, and it widens because each
                year&apos;s charge also gives up what that money would have earned afterwards. The cheap path finishes
                a little above {money(plan.goal)} because the monthly figure is rounded up.
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
