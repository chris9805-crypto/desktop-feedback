"use client";

import Link from "next/link";
import { useState } from "react";
import { DisclaimerFooter } from "@/components/Disclaimer";
import { ExposureExplorer } from "@/components/ExposureExplorer";
import { FindingCard } from "@/components/FindingCard";
import { MiniBar, StackedBar } from "@/components/charts";
import { Button, Callout, Card, EmptyState, Pill, SectionHeading, Stat, StatGrid } from "@/components/ui";
import { ASSET_CLASSES } from "@/lib/engine/types";
import { formatCurrency, formatPercent, label } from "@/lib/format";
import { useStore } from "@/lib/state/store";

export default function AnalysisPage() {
  const { report, hasHoldings, loading, loadSample } = useStore();
  const [showCaveats, setShowCaveats] = useState(false);
  const currency = report.portfolio.baseCurrency;

  if (loading) {
    return <p className="py-20 text-center text-[13px] text-[var(--text-muted)]">Loading your saved portfolio…</p>;
  }

  if (!hasHoldings) {
    return (
      <EmptyState
        title="No holdings to analyse"
        action={
          <>
            <Button href="/portfolio">Enter your holdings</Button>
            <Button variant="secondary" onClick={loadSample}>
              Load the example portfolio
            </Button>
          </>
        }
      >
        The gap report compares what you hold against a reference model built from your own answers. Add some holdings
        first, or load the example to see what it produces.
      </EmptyState>
    );
  }

  const { metrics, reference, findings, profile } = report;
  const assetSlices = ASSET_CLASSES.filter((key) => metrics.exposure.assetClass[key] > 0.001).map((key) => ({
    label: label(key),
    value: metrics.exposure.assetClass[key],
  }));
  const heldGrowth =
    metrics.exposure.assetClass.equity + metrics.exposure.assetClass.realEstate + metrics.exposure.assetClass.commodity;
  const referenceGrowth = reference.assetClass.equity + reference.assetClass.realEstate + reference.assetClass.commodity;
  const topNames = metrics.lookThrough.slice(0, 12);
  const maxName = topNames[0]?.weight ?? 0.01;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-[var(--text)]">Gap report</h1>
          <p className="tnum mt-1.5 text-[13px] text-[var(--text-muted)]">
            {formatCurrency(report.portfolio.totalValue, currency)} across {report.portfolio.positions.length} position
            {report.portfolio.positions.length === 1 ? "" : "s"} · {label(profile.goal)} in {profile.horizonYears} years
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" href="/profile">
            Adjust the reference
          </Button>
          <Button variant="secondary" href="/portfolio">
            Edit holdings
          </Button>
        </div>
      </header>

      <Card>
        <StatGrid>
          <Stat label="Growth assets" value={formatPercent(heldGrowth)} detail={`Reference ${formatPercent(referenceGrowth)}`} tone={Math.abs(heldGrowth - referenceGrowth) > 0.07 ? (heldGrowth > referenceGrowth ? "over" : "under") : "neutral"} />
          <Stat label="Est. volatility" value={formatPercent(metrics.estimatedVolatility)} detail={`Beta ${metrics.weightedBeta.toFixed(2)} to a broad index`} />
          <Stat label="Effective holdings" value={`${Math.round(metrics.diversification.effectiveNames)}`} detail={`${metrics.diversification.lookThroughNameCount.toLocaleString()} companies, unevenly weighted`} />
          <Stat label="Largest company" value={formatPercent(metrics.diversification.topHoldingWeight)} detail={topNames[0]?.name ?? "—"} tone={metrics.diversification.topHoldingWeight > 0.08 ? "over" : "neutral"} />
          <Stat label="Ongoing charges" value={formatPercent(metrics.weightedExpenseRatio, 2)} detail={`${formatCurrency(metrics.annualCost, currency)} a year · benchmark ${formatPercent(reference.costBenchmark, 2)}`} tone={metrics.weightedExpenseRatio > reference.costBenchmark + 0.0008 ? "over" : "neutral"} />
          <Stat label="Distribution yield" value={formatPercent(metrics.exposure.yield)} detail={profile.incomeNeedRate > 0 ? `Against ${formatPercent(profile.incomeNeedRate)} drawn` : "No withdrawals stated"} />
          <Stat label="Bond duration" value={metrics.exposure.duration > 0 ? `${metrics.exposure.duration.toFixed(1)}y` : "—"} detail={`Reference ${reference.targetDuration.toFixed(1)}y`} />
          <Stat label="Findings" value={`${findings.length}`} detail="Ranked by how much of the portfolio each touches" />
        </StatGrid>
      </Card>

      <Card className="p-5">
        <SectionHeading
          title="What the money is in"
          description="Asset class shares of the whole portfolio, including any uninvested cash."
        />
        <StackedBar slices={assetSlices} />
      </Card>

      <section>
        <SectionHeading
          title={findings.length > 0 ? `${findings.length} gaps between your portfolio and the reference` : "No material gaps found"}
          description="The number on each row ranks how much of the portfolio the finding touches. It is an ordering, not a severity or a risk score, and a low-ranked finding can still matter more to you than a high-ranked one."
        />
        {findings.length === 0 ? (
          <Callout title="Nothing crossed a materiality threshold">
            On every check the engine runs, this portfolio sits within the thresholds of its reference model. That means
            no gap was large enough to be worth reporting — not that the portfolio is right for you, which is a question
            this tool does not answer. Adjusting the reference inputs will change what counts as a gap.
          </Callout>
        ) : (
          <div className="space-y-3">
            {findings.map((finding) => (
              <FindingCard key={finding.id} finding={finding} currency={currency} />
            ))}
          </div>
        )}
      </section>

      <Card className="p-5">
        <SectionHeading
          title="Exposure, dimension by dimension"
          description="The same portfolio, sliced different ways, each against the corresponding reference weight."
        />
        <ExposureExplorer report={report} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionHeading
            title="Largest companies, counted through funds"
            description="Direct holdings and fund holdings added together. This is where most people find a weight they did not know they had."
          />
          <table className="w-full text-[12.5px]">
            <tbody className="divide-y divide-[var(--border)]">
              {topNames.map((name) => (
                <tr key={name.symbol}>
                  <td className="py-2 pr-3">
                    <div className="font-medium text-[var(--text)]">{name.name}</div>
                    <div className="text-[11.5px] text-[var(--text-faint)]">{name.symbol}</div>
                  </td>
                  <td className="w-[38%] py-2">
                    <MiniBar value={name.weight} max={maxName} />
                  </td>
                  <td className="tnum w-[64px] py-2 pl-3 text-right font-medium">{formatPercent(name.weight)}</td>
                  <td className="tnum w-[80px] py-2 pl-2 text-right text-[var(--text-muted)]">
                    {formatCurrency(name.value, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[11.5px] leading-relaxed text-[var(--text-faint)]">
            Funds publish only their largest holdings, so companies outside every fund&apos;s disclosed list do not
            appear here. The concentration figures above account for that remainder; this table does not.
          </p>
        </Card>

        <Card className="p-5">
          <SectionHeading
            title="The reference model"
            description="What your portfolio is being compared against, and how it was derived."
          />
          <div className="flex flex-wrap gap-2">
            <Pill tone="accent">{reference.label}</Pill>
            <Pill>Growth {formatPercent(reference.inputs.growthShare)}</Pill>
            <Pill>Capacity {Math.round(reference.inputs.riskCapacityScore * 100)}/100</Pill>
            {reference.inputs.homeBiasAllowancePp > 0 ? (
              <Pill>Home tilt +{reference.inputs.homeBiasAllowancePp}pp</Pill>
            ) : null}
          </div>
          <ol className="mt-4 space-y-2.5">
            {reference.rationale.map((line, index) => (
              <li key={line} className="flex gap-3 text-[12.5px] leading-relaxed text-[var(--text-muted)]">
                <span className="tnum mt-[1px] shrink-0 text-[11px] font-semibold text-[var(--accent-text)]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {line}
              </li>
            ))}
          </ol>
          <div className="mt-4">
            <Link href="/profile" className="text-[12px] font-medium text-[var(--accent-text)] hover:underline">
              Change the inputs behind this model →
            </Link>
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <button
          type="button"
          onClick={() => setShowCaveats((value) => !value)}
          aria-expanded={showCaveats}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <span>
            <span className="block text-[14px] font-semibold text-[var(--text)]">
              What this analysis could not see
            </span>
            <span className="mt-0.5 block text-[12.5px] text-[var(--text-muted)]">
              {report.caveats.length} limits that affect how the findings above should be read.
            </span>
          </span>
          <span className="shrink-0 text-[12px] text-[var(--text-faint)]">{showCaveats ? "Hide" : "Show"}</span>
        </button>
        {showCaveats ? (
          <ul className="mt-4 space-y-2.5 border-t border-[var(--border)] pt-4">
            {report.caveats.map((caveat) => (
              <li key={caveat} className="flex gap-2.5 text-[12.5px] leading-relaxed text-[var(--text-muted)]">
                <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[var(--warn)]" aria-hidden="true" />
                {caveat}
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <DisclaimerFooter />
    </div>
  );
}
