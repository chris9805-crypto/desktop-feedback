import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DisclaimerFooter } from "@/components/Disclaimer";
import { ScoreMeter, StackedBar } from "@/components/charts";
import { Callout, Card, LearnLink, Pill, SectionHeading, Stat, StatGrid } from "@/components/ui";
import { SECURITIES, lookupSecurity } from "@/lib/data/securities";
import { buildExposure } from "@/lib/engine/exposure";
import { allScores, type ScoreBreakdown } from "@/lib/engine/scores";
import { REGIONS, SECTORS, type EtfSecurity, type StockSecurity } from "@/lib/engine/types";
import { formatCompactCurrency, formatCurrency, formatMultiple, formatPercent, label } from "@/lib/format";

export function generateStaticParams() {
  return SECURITIES.map((security) => ({ symbol: security.symbol }));
}

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }): Promise<Metadata> {
  const { symbol } = await params;
  const security = lookupSecurity(symbol);
  if (!security) return { title: "Not found" };
  return { title: `${security.symbol} — ${security.name}`, description: security.description };
}

export default async function SecurityPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const security = lookupSecurity(decodeURIComponent(symbol));
  if (!security) notFound();

  return (
    <div className="space-y-8">
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[24px] font-semibold tracking-tight text-[var(--text)]">{security.symbol}</h1>
          <Pill tone={security.kind === "etf" ? "accent" : "neutral"}>{security.kind === "etf" ? "ETF" : "Company"}</Pill>
          <Pill>{security.listingCountry}</Pill>
          <Pill>{security.currency}</Pill>
        </div>
        <p className="mt-1 text-[15px] text-[var(--text-muted)]">{security.name}</p>
        <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-[var(--text-muted)]">{security.description}</p>
      </header>

      {security.kind === "etf" ? <EtfDetail security={security} /> : <StockDetail security={security} />}

      <p className="text-[12px] text-[var(--text-faint)]">
        <Link href="/research" className="text-[var(--accent-text)] hover:underline">
          ← Back to research
        </Link>
      </p>

      <DisclaimerFooter />
    </div>
  );
}

function EtfDetail({ security }: { security: EtfSecurity }) {
  const exposure = buildExposure(security);
  const regionSlices = REGIONS.filter((key) => exposure.region[key] > 0.005).map((key) => ({
    label: label(key),
    value: exposure.region[key],
  }));
  const sectorSlices = SECTORS.filter((key) => exposure.sector[key] > 0.01)
    .map((key) => ({ label: label(key), value: exposure.sector[key] }))
    .sort((a, b) => b.value - a.value);

  return (
    <>
      <Card>
        <StatGrid>
          <Stat label="Ongoing charge" value={formatPercent(security.fund.expenseRatio, 2)} detail={`${formatCurrency(security.fund.expenseRatio * 10000, "USD")} a year per $10,000`} />
          <Stat label="Fund size" value={formatCompactCurrency(security.fund.aumUsd, "USD")} />
          <Stat label="Holdings" value={security.fund.holdingsCount.toLocaleString()} />
          <Stat label="Distribution yield" value={security.yield > 0 ? formatPercent(security.yield) : "Accumulating"} />
          <Stat label="Median spread" value={formatPercent(security.fund.spread, 3)} detail="Paid on every trade, in and out" />
          <Stat label="Tracking difference" value={formatPercent(security.fund.trackingDifference, 2)} detail="Annualised gap to the index, after costs" />
          <Stat label="Domicile" value={security.fund.domicile} detail={label(security.fund.distribution)} />
          <Stat label="Duration" value={security.duration > 0 ? `${security.duration.toFixed(1)}y` : "—"} detail={security.duration > 0 ? `A 1pp yield rise costs about ${formatPercent(security.duration * 0.01, 1)}` : undefined} />
        </StatGrid>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {regionSlices.length > 0 ? (
          <Card className="p-5">
            <SectionHeading title="Geography" description={`Tracks ${security.fund.indexName}.`} />
            <StackedBar slices={regionSlices} />
          </Card>
        ) : null}
        {sectorSlices.length > 0 ? (
          <Card className="p-5">
            <SectionHeading title="Sector" />
            <StackedBar slices={sectorSlices} />
          </Card>
        ) : null}
      </div>

      {security.topHoldings.length > 0 ? (
        <Card className="p-5">
          <SectionHeading
            title="Largest disclosed holdings"
            description={`The top ${security.topHoldings.length} of ${security.fund.holdingsCount.toLocaleString()} positions, and ${formatPercent(security.topHoldings.reduce((a, h) => a + h.weight, 0))} of the fund.`}
          />
          <table className="w-full text-[13px]">
            <tbody className="divide-y divide-[var(--border)]">
              {security.topHoldings.map((holding) => (
                <tr key={holding.symbol}>
                  <td className="py-2 pr-3">
                    {lookupSecurity(holding.symbol) ? (
                      <Link href={`/research/${holding.symbol}`} className="font-medium text-[var(--text)] hover:underline">
                        {holding.name}
                      </Link>
                    ) : (
                      <span className="font-medium text-[var(--text)]">{holding.name}</span>
                    )}
                    <span className="ml-2 text-[11.5px] text-[var(--text-faint)]">{holding.symbol}</span>
                  </td>
                  <td className="tnum w-[80px] py-2 text-right font-medium">{formatPercent(holding.weight)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      <Callout title="What to check on any fund before the fee">
        The ongoing charge is the visible cost and rarely the whole cost. Tracking difference tells you what the fund
        actually delivered against its index after everything, including any securities-lending revenue that offsets
        charges. Spread is paid on each trade and matters most for smaller funds and frequent purchases. Domicile and
        distribution policy decide the tax treatment, which in a taxable account can outweigh all of it.{" "}
        <LearnLink slug="costs">More on costs</LearnLink>
      </Callout>
    </>
  );
}

function StockDetail({ security }: { security: StockSecurity }) {
  const scores = allScores(security);
  const f = security.fundamentals;
  const v = security.valuation;

  return (
    <>
      <Card>
        <StatGrid>
          <Stat label="Market value" value={formatCompactCurrency(security.marketCapUsd, "USD")} detail={`${label(security.size)} · ${label(security.style)}`} />
          <Stat label="Revenue" value={formatCompactCurrency(f.revenueUsd, "USD")} detail={`${formatPercent(f.revenueCagr3y)} 3-year growth`} />
          <Stat label="Operating margin" value={formatPercent(f.operatingMargin)} />
          <Stat label="Return on capital" value={formatPercent(f.returnOnInvestedCapital)} />
          <Stat label="Free cash flow yield" value={formatPercent(v.freeCashFlowYield)} />
          <Stat label="P/E" value={v.priceEarnings > 0 ? v.priceEarnings.toFixed(1) : "n/a"} detail={`Forward ${v.forwardPriceEarnings.toFixed(1)}`} />
          <Stat label="Net debt / EBITDA" value={formatMultiple(f.netDebtToEbitda)} tone={f.netDebtToEbitda > 3 && security.sector !== "financials" ? "over" : "neutral"} />
          <Stat
            label="Dividend yield"
            value={f.dividendYield <= 0 ? "None" : f.dividendYield < 0.005 ? formatPercent(f.dividendYield, 2) : formatPercent(f.dividendYield)}
            detail={f.dividendYield >= 0.005 ? `Payout ${formatPercent(f.payoutRatio, 0)} · ${f.dividendGrowthStreakYears}y of growth` : f.dividendYield > 0 ? "A token payout; too small to analyse" : undefined}
          />
        </StatGrid>
      </Card>

      <Card className="p-5">
        <SectionHeading
          title="Composite scores"
          description="Each score averages the components beneath it on a fixed 0-100 scale. They summarise published figures so a profile is quick to read; they are not ratings, forecasts or a view on whether anything is worth owning."
        />
        <div className="grid gap-6 sm:grid-cols-2">
          <ScoreBlock title="Quality" breakdown={scores.quality} />
          <ScoreBlock title="Financial strength" breakdown={scores.strength} />
          <ScoreBlock title="Past growth" breakdown={scores.growth} />
          <ScoreBlock title="Valuation" breakdown={scores.valuation} />
          {scores.dividend ? <ScoreBlock title="Dividend durability" breakdown={scores.dividend} /> : null}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <SectionHeading title="Profitability and cash" />
          <MetricRows
            rows={[
              ["Gross margin", formatPercent(f.grossMargin)],
              ["Operating margin", formatPercent(f.operatingMargin)],
              ["Net margin", formatPercent(f.netMargin)],
              ["Free cash flow margin", formatPercent(f.freeCashFlowMargin)],
              ["Return on invested capital", formatPercent(f.returnOnInvestedCapital)],
              ["Return on equity", formatPercent(f.returnOnEquity)],
            ]}
          />
        </Card>
        <Card className="p-5">
          <SectionHeading title="Balance sheet and shares" />
          <MetricRows
            rows={[
              ["Net debt / EBITDA", formatMultiple(f.netDebtToEbitda)],
              ["Interest cover", f.interestCover > 0 ? formatMultiple(f.interestCover, 0) : "n/a"],
              ["Current ratio", formatMultiple(f.currentRatio, 2)],
              ["Share count change, 5y", formatPercent(f.shareCountCagr5y)],
              ["Price / book", v.priceToBook > 0 ? v.priceToBook.toFixed(2) : "negative equity"],
              ["EV / EBIT", v.evToEbit.toFixed(1)],
            ]}
          />
        </Card>
      </div>

      <Callout title="Reading these numbers">
        Compare a company with its own sector before drawing a conclusion. Banks and insurers cannot be assessed on
        leverage ratios at all, since leverage is their business model. Utilities and REITs run high payout ratios and
        high debt by design. A negative book value usually reflects years of buybacks rather than distress.{" "}
        <LearnLink slug="balance-sheets">More on balance sheets</LearnLink>
      </Callout>
    </>
  );
}

function ScoreBlock({ title, breakdown }: { title: string; breakdown: ScoreBreakdown }) {
  return (
    <div>
      <ScoreMeter label={title} score={breakdown.score} detail={breakdown.note} />
      <dl className="mt-3 space-y-1">
        {breakdown.components.map((component) => (
          <div key={component.label} className="flex items-baseline justify-between gap-3 text-[12px]">
            <dt className="text-[var(--text-muted)]">{component.label}</dt>
            <dd className="tnum font-medium text-[var(--text)]">{component.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function MetricRows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="divide-y divide-[var(--border)]">
      {rows.map(([name, value]) => (
        <div key={name} className="flex items-baseline justify-between gap-4 py-2 text-[13px]">
          <dt className="text-[var(--text-muted)]">{name}</dt>
          <dd className="tnum font-medium text-[var(--text)]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
