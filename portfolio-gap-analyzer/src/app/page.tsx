"use client";

import Link from "next/link";
import { useMemo } from "react";
import { FeeGapChart, RangeChart } from "@/components/PrimerCharts";
import { StartButtons } from "@/components/StartButtons";
import { Term } from "@/components/Term";
import { Callout, Card, Field, inputClass } from "@/components/ui";
import { DATASET_META } from "@/lib/data/dataset-meta";
import { allocationIllustration, feeIllustration } from "@/lib/engine/primer";
import { formatCurrency, formatPercent } from "@/lib/format";
import { useStore } from "@/lib/state/store";

/**
 * The first screen, and deliberately not a feature tour.
 *
 * Someone arriving here usually wants to know which fund to buy. That is the
 * last question. Two things are settled before any ticker matters — how much
 * sits in shares, and what the holding costs each year — and both are
 * arithmetic that can be drawn rather than asserted. So the page opens with
 * them, on the reader's own numbers, and only then offers the rest of the tool.
 */
export default function HomePage() {
  const { state, setPrimer } = useStore();
  const { amount, monthlyContribution, years } = state.primer;
  const currency = state.profile.baseCurrency;

  const allocation = useMemo(
    () => allocationIllustration({ amount, monthlyContribution, years }),
    [amount, monthlyContribution, years],
  );
  const fees = useMemo(() => feeIllustration({ amount, monthlyContribution, years }), [amount, monthlyContribution, years]);

  const money = (value: number) => formatCurrency(value, currency);
  const safest = allocation.bands[0]!;
  const boldest = allocation.bands[allocation.bands.length - 1]!;
  // The mix with the best worst-case, which is usually not the boldest one.
  const bestFloor = allocation.bands.reduce((best, band) => (band.p10 > best.p10 ? band : best));

  return (
    <div className="space-y-12">
      <section className="pt-3">
        <p className="text-[12px] font-medium uppercase tracking-wider text-[var(--accent-text)]">
          Research and education for stock and ETF investors
        </p>
        <h1 className="mt-3 max-w-3xl text-[30px] font-semibold leading-[1.15] tracking-tight text-[var(--text)] sm:text-[36px]">
          Two decisions matter more than which fund you buy.
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--text-muted)]">
          How much sits in shares, and what you pay to hold it. Both are settled before any ticker matters, and both are
          just arithmetic. Here they are on your numbers.
        </p>
      </section>

      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Starting with">
            <input
              className={inputClass}
              type="number"
              min={0}
              step={1000}
              value={amount}
              onChange={(event) => setPrimer({ amount: Math.max(0, Number(event.target.value) || 0) })}
            />
          </Field>
          <Field label="Adding each month">
            <input
              className={inputClass}
              type="number"
              min={0}
              step={50}
              value={monthlyContribution}
              onChange={(event) => setPrimer({ monthlyContribution: Math.max(0, Number(event.target.value) || 0) })}
            />
          </Field>
          <Field label={`For ${years} years`}>
            <input
              type="range"
              min={5}
              max={45}
              step={1}
              value={years}
              onChange={(event) => setPrimer({ years: Number(event.target.value) })}
              className="mt-2 w-full accent-[var(--accent)]"
            />
          </Field>
        </div>
        <p className="mt-3 text-[12px] text-[var(--text-faint)]">
          {money(allocation.contributed)} of your own money goes in over {years} years. Everything below is in
          today&apos;s money, so a figure means what it would buy today.
        </p>
      </Card>

      <section>
        <div className="flex items-baseline gap-3">
          <span className="tnum text-[13px] font-semibold text-[var(--accent-text)]">01</span>
          <h2 className="text-[20px] font-semibold tracking-tight text-[var(--text)]">
            How much you put in shares sets the range
          </h2>
        </div>
        <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-[var(--text-muted)]">
          Shares have paid more than bonds over long periods, and moved far more along the way. That trade — not the
          choice between two similar funds — is what decides the spread of where you end up.
        </p>

        <Card className="mt-5 p-5">
          <RangeChart bands={allocation.bands} currency={currency} contributed={allocation.contributed} />
        </Card>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Callout title="What more shares bought" tone="accent">
            The middle outcome went from {money(safest.p50)} with no shares to {money(boldest.p50)} with nothing else —
            about {allocation.medianMultiple.toFixed(1)}× on the same {money(allocation.contributed)} paid in.
          </Callout>
          <Callout title="What it cost" tone="warn">
            All shares also had the worst bad case: the lowest tenth of outcomes landed at {money(boldest.p10)}, against{" "}
            {money(bestFloor.p10)} for {bestFloor.label.toLowerCase()}. A rough bad year runs to{" "}
            {formatPercent(Math.abs(boldest.roughBadYear), 0)} against {formatPercent(Math.abs(safest.roughBadYear), 0)}.
          </Callout>
        </div>

        <p className="mt-4 max-w-3xl text-[13px] leading-relaxed text-[var(--text-muted)]">
          There is no mix that wins on both. Which one fits depends on when you need the money and what you would do in
          a bad year — which is what the{" "}
          <Link href="/reference" className="font-medium text-[var(--accent-text)] hover:underline">
            reference portfolio
          </Link>{" "}
          works out from your own answers, rather than guessing at it here.
        </p>
      </section>

      <section>
        <div className="flex items-baseline gap-3">
          <span className="tnum text-[13px] font-semibold text-[var(--accent-text)]">02</span>
          <h2 className="text-[20px] font-semibold tracking-tight text-[var(--text)]">
            What you pay comes out of the same money
          </h2>
        </div>
        <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-[var(--text-muted)]">
          A charge is quoted as a small percentage a year. It is paid on everything you hold, every year, and each
          year&apos;s charge also gives up whatever that money would have earned afterwards.
        </p>

        <Card className="mt-5 p-5">
          <FeeGapChart points={fees.points} currency={currency} difference={fees.difference} />
        </Card>

        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Card className="p-4">
            <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">The quoted number</div>
            <div className="tnum mt-1 text-[19px] font-semibold text-[var(--text)]">{money(fees.firstYearCharge)}</div>
            <p className="mt-1.5 text-[12px] leading-snug text-[var(--text-muted)]">
              {formatPercent(fees.highCharge, 2)} on {money(amount)} in the first year. It sounds small because it is
              small — once.
            </p>
          </Card>
          <Card className="p-4">
            <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">What it costs by year {years}</div>
            <div className="tnum mt-1 text-[19px] font-semibold text-[var(--over)]">{money(fees.difference)}</div>
            <p className="mt-1.5 text-[12px] leading-snug text-[var(--text-muted)]">
              {formatPercent(fees.shareOfOutcome, 0)} of what the cheaper version ends with, gone to the difference
              between {formatPercent(fees.highCharge, 2)} and {formatPercent(fees.lowCharge, 2)}.
            </p>
          </Card>
          <Card className="p-4">
            <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">Put another way</div>
            <div className="tnum mt-1 text-[19px] font-semibold text-[var(--text)]">
              {fees.contributionYears === null ? "—" : `${fees.contributionYears.toFixed(0)} years`}
            </div>
            <p className="mt-1.5 text-[12px] leading-snug text-[var(--text-muted)]">
              {fees.contributionYears === null
                ? "Add a monthly amount above to see the gap in years of contributions."
                : `of your ${money(monthlyContribution * 12)} a year, to cover the same gap.`}
            </p>
          </Card>
        </div>

        <p className="mt-4 max-w-3xl text-[13px] leading-relaxed text-[var(--text-muted)]">
          Both lines assume the same {formatPercent(fees.growth, 0)} return before charges — the only difference is the{" "}
          <Term k="ongoingCharge">ongoing charge</Term>. A higher charge can still be worth paying; the point is to know
          what is being paid for.{" "}
          <Link href="/research" className="font-medium text-[var(--accent-text)] hover:underline">
            Check a charge you have been quoted
          </Link>
          .
        </p>
      </section>

      <section>
        <div className="flex items-baseline gap-3">
          <span className="tnum text-[13px] font-semibold text-[var(--accent-text)]">03</span>
          <h2 className="text-[20px] font-semibold tracking-tight text-[var(--text)]">Then, which holdings</h2>
        </div>
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
            The illustrations above are long-run averages run through a simulation, not a view on what happens next. No
            price targets, no ratings. Assumed rates are labelled wherever they are used.
          </p>
        </Card>
      </section>

      <Callout tone="warn" title="About the data in this build">
        {DATASET_META.warning} The dataset is dated {DATASET_META.asOf}.
      </Callout>
    </div>
  );
}
