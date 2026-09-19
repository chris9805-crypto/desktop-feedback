"use client";

import { DisclaimerFooter } from "@/components/Disclaimer";
import { ProjectionPanel } from "@/components/Projection";
import { Term } from "@/components/Term";
import { PieChart } from "@/components/charts";
import { normaliseSleeve } from "@/lib/engine/exposure";
import { Button, Callout, Card, Field, Pill, SectionHeading, inputClass } from "@/components/ui";
import { INFLATION_STANCES, PRESET_LIST, type ReferencePresetId } from "@/lib/engine/presets";
import { ASSET_CLASSES, REGIONS, SECTORS, SIZE_BUCKETS, type Goal, type Region, type TaxWrapper } from "@/lib/engine/types";
import { formatPercent, label } from "@/lib/format";
import { useStore } from "@/lib/state/store";

const GOALS: Goal[] = ["retirement", "houseDeposit", "educationFund", "incomeNow", "generalGrowth"];
/** The regions offered as "where you will spend it", not the exposure buckets. */
const HOME_REGIONS: Region[] = ["us", "uk", "europeExUk", "canada", "japan", "asiaPacificDeveloped", "emergingMarkets"];
const WRAPPERS: TaxWrapper[] = ["taxAdvantaged", "taxable", "mixed"];

const TOLERANCE_COPY: Record<number, string> = {
  1: "A fall of 10% would worry me enough to want out.",
  2: "I could sit through a 15% fall, but not comfortably.",
  3: "A 25% fall would be unpleasant and I would hold on.",
  4: "A 35% fall is the cost of doing business.",
  5: "A 50% fall would not change what I do.",
};

/** The growth share each answer allows, mirroring TOLERANCE_GROWTH in the engine. */
const TOLERANCE_ALLOWS: Record<number, string> = { 1: "25%", 2: "42%", 3: "60%", 4: "78%", 5: "92%" };

const BINDING_COPY: Record<string, string> = {
  tolerance: "your risk tolerance",
  capacity: "your circumstances",
  horizon: "the horizon",
};

export default function ProfilePage() {
  const { state, report, setProfile, setReferenceOverrides, setProjectionReturn, hasHoldings } = useStore();
  const profile = state.profile;
  const reference = report.reference;

  const assetSlices = ASSET_CLASSES.filter((k) => reference.assetClass[k] > 0.001).map((k) => ({
    label: label(k),
    value: reference.assetClass[k],
  }));

  // The equity sleeve's own shape, normalised so it reads as "of the shares
  // this model holds" rather than as a share of the whole portfolio.
  const equitySleeve = normaliseSleeve(reference.region, REGIONS);
  const regionSlices = REGIONS.filter((k) => equitySleeve[k] > 0.005).map((k) => ({ label: label(k), value: equitySleeve[k] }));
  const sectorSleeve = normaliseSleeve(reference.sector, SECTORS);
  const sectorSlices = SECTORS.filter((k) => sectorSleeve[k] > 0.005)
    .map((k) => ({ label: label(k), value: sectorSleeve[k] }))
    .sort((a, b) => b.value - a.value);
  const sizeSleeve = normaliseSleeve(reference.size, SIZE_BUCKETS);
  const sizeSlices = SIZE_BUCKETS.filter((k) => sizeSleeve[k] > 0.005).map((k) => ({ label: label(k), value: sizeSleeve[k] }));

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[12px] font-medium uppercase tracking-wider text-[var(--accent-text)]">Start here</p>
        <h1 className="mt-2 text-[24px] font-semibold tracking-tight text-[var(--text)]">The reference portfolio</h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[var(--text-muted)]">
          Before you look at what you own, it helps to have something to compare it against. This page builds that: a
          plain, fully described mix of <Term k="share">shares</Term> and <Term k="bond">bonds</Term>, sized to how
          long your money has and how much of a fall you could live with.
        </p>
        <p className="mt-2.5 max-w-2xl text-[14px] leading-relaxed text-[var(--text-muted)]">
          It is a <Term k="benchmark">yardstick</Term>, not a target, and nobody is recommending it. Everything below
          comes from answers you give, and you can see the working.
        </p>
        {!hasHoldings ? (
          <Callout tone="accent" title="New to this, and don't own anything yet?">
            You are in the right place — nothing on this page needs you to own a single thing. Answer the questions,
            watch the mix change, and use it to judge anything you get offered. Words with a{" "}
            <span className="border-b border-dotted border-[var(--text-faint)]">dotted underline</span> have a plain
            definition one tap away.
          </Callout>
        ) : null}
      </div>

      <Card className="p-5">
        <SectionHeading
          title="The index your portfolio is compared against"
          description="A published list of companies to compare against. Not sure? The first one is the broadest well-known choice."
        />
        <div className="grid gap-3 sm:grid-cols-3">
          {PRESET_LIST.map((preset) => {
            const selected = (state.referenceOverrides.presetId ?? "msciWorld") === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setReferenceOverrides({ ...state.referenceOverrides, presetId: preset.id as ReferencePresetId })}
                className={`rounded-[var(--radius)] border p-4 text-left transition-colors ${
                  selected
                    ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                    : "border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-strong)]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-semibold text-[var(--text)]">{preset.label}</span>
                  {selected ? <Pill tone="accent">In use</Pill> : null}
                </div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--text-muted)]">{preset.blurb}</p>
                <p className="tnum mt-2 text-[11.5px] text-[var(--text-faint)]">
                  Long-run real return {formatPercent(preset.realReturn)} · volatility {formatPercent(preset.volatility)}
                </p>
              </button>
            );
          })}
        </div>
        <div className="mt-4">
          <Callout tone="warn" title={`What choosing ${reference.presetLabel} means for your report`}>
            {reference.indexNote}
          </Callout>
        </div>
      </Card>

      <Card className="p-5">
        <SectionHeading
          title={`What the ${reference.presetLabel} reference portfolio holds`}
          description="Adjust anything below and these move with it."
        />
        <div className="grid gap-x-8 gap-y-7 sm:grid-cols-2">
          <PieChart title="Across the whole portfolio" slices={assetSlices} />
          <PieChart title="Equity sleeve by region" slices={regionSlices} />
          <PieChart title="Equity sleeve by company size" slices={sizeSlices} />
          <PieChart title="Equity sleeve by sector" slices={sectorSlices} />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-6">
          <Card className="p-5">
            <SectionHeading
              title="What the money is for, and when"
              description="These size the bond sleeve and the cash floor, not the index."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="What is the money for">
                <select
                  className={inputClass}
                  value={profile.goal}
                  onChange={(event) => setProfile({ goal: event.target.value as Goal })}
                >
                  {GOALS.map((goal) => (
                    <option key={goal} value={goal}>
                      {label(goal)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Years until you need it" hint="The single largest input to the model">
                <input
                  className={inputClass}
                  type="number"
                  min={1}
                  max={50}
                  value={profile.horizonYears}
                  onChange={(event) => setProfile({ horizonYears: Math.max(1, Number(event.target.value) || 1) })}
                />
              </Field>
              <Field label="Where you will spend it">
                <select
                  className={inputClass}
                  value={profile.homeRegion}
                  onChange={(event) => setProfile({ homeRegion: event.target.value as Region })}
                >
                  {HOME_REGIONS.map((region) => (
                    <option key={region} value={region}>
                      {label(region)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Account type" hint="Affects how the tool talks about tax, never calculates it">
                <select
                  className={inputClass}
                  value={profile.taxWrapper}
                  onChange={(event) => setProfile({ taxWrapper: event.target.value as TaxWrapper })}
                >
                  {WRAPPERS.map((wrapper) => (
                    <option key={wrapper} value={wrapper}>
                      {label(wrapper)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Card>

          <Card className="p-5">
            <SectionHeading
              title="What a bad year would do to you"
              description="Not how you feel — what your situation could absorb without the plan breaking."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Monthly contribution" hint="New money arriving each month">
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  value={profile.monthlyContribution}
                  onChange={(event) => setProfile({ monthlyContribution: Math.max(0, Number(event.target.value) || 0) })}
                />
              </Field>
              <Field label="Essential monthly spending" hint="What you would need if you cut back">
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  value={profile.monthlyEssentialSpend}
                  onChange={(event) => setProfile({ monthlyEssentialSpend: Math.max(0, Number(event.target.value) || 0) })}
                />
              </Field>
              <Field label="Emergency buffer" hint="Months of essential spending you keep in cash, outside all this">
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  max={24}
                  value={profile.emergencyFundMonths}
                  onChange={(event) => setProfile({ emergencyFundMonths: Math.max(0, Number(event.target.value) || 0) })}
                />
              </Field>
              <Field label="Annual withdrawal rate" hint="Percent you take out each year to live on. 0 if you are still saving.">
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  max={15}
                  step={0.5}
                  value={Math.round(profile.incomeNeedRate * 1000) / 10}
                  onChange={(event) => setProfile({ incomeNeedRate: Math.max(0, Number(event.target.value) || 0) / 100 })}
                />
              </Field>
            </div>
          </Card>

          <Card className="p-5">
            <SectionHeading title="How you would react to a bad year" description="How you would react, as opposed to what you could withstand." />
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={profile.riskTolerance}
              onChange={(event) => setProfile({ riskTolerance: Number(event.target.value) as 1 | 2 | 3 | 4 | 5 })}
              className="w-full accent-[var(--accent)]"
              aria-label="Risk tolerance from 1 to 5"
            />
            <p className="mt-2 text-[13px] text-[var(--text-muted)]">
              <span className="font-medium text-[var(--text)]">{profile.riskTolerance} of 5.</span>{" "}
              {TOLERANCE_COPY[profile.riskTolerance]}{" "}
              <span className="text-[var(--text-faint)]">
                Allows up to {TOLERANCE_ALLOWS[profile.riskTolerance]} in growth assets.
              </span>
            </p>
            <div className="mt-5">
              <Field
                label={`Deliberate home-country tilt: ${profile.homeBiasAllowancePp} points`}
                hint="Extra weight to your own market, above its share of global market value. Zero means the reference uses global weights exactly."
              >
                <input
                  type="range"
                  min={0}
                  max={50}
                  step={5}
                  value={profile.homeBiasAllowancePp}
                  onChange={(event) => setProfile({ homeBiasAllowancePp: Number(event.target.value) })}
                  className="w-full accent-[var(--accent)]"
                />
              </Field>
            </div>
          </Card>

          <Card className="p-5">
            <SectionHeading
              title="Inflation"
              description="Rising prices eat what your money can buy. This changes what your bonds are, not how many you hold."
            />
            <div className="grid gap-2 sm:grid-cols-3">
              {INFLATION_STANCES.map((stance) => {
                const selected = profile.inflationConcern === stance.id;
                return (
                  <button
                    key={stance.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setProfile({ inflationConcern: stance.id })}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      selected
                        ? "border-[var(--accent)] bg-[var(--accent-soft)]"
                        : "border-[var(--border)] hover:border-[var(--border-strong)]"
                    }`}
                  >
                    <div className="text-[13px] font-semibold text-[var(--text)]">{stance.label}</div>
                    <p className="mt-1 text-[11.5px] leading-snug text-[var(--text-muted)]">{stance.blurb}</p>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-[12.5px] leading-relaxed text-[var(--text-muted)]">
              {INFLATION_STANCES[profile.inflationConcern]?.detail}
            </p>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <SectionHeading
              title="The model in four numbers"
              description="What the choices above add up to."
            />
            <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-lg bg-[var(--surface-2)] px-4 py-3">
              <span className="text-[17px] font-semibold text-[var(--text)]">{reference.riskProfileLabel}</span>
              <span className="tnum text-[13px] text-[var(--text-muted)]">
                {formatPercent(reference.inputs.growthShare, 0)} growth / {formatPercent(1 - reference.inputs.growthShare, 0)} defensive
              </span>
              <span className="w-full text-[12px] text-[var(--text-muted)]">
                Set by {BINDING_COPY[reference.bindingConstraint]} — the tightest of the three limits. Raising the other
                two would not move it.
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-[var(--border)] pt-4">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">Growth assets</dt>
                <dd className="tnum text-[16px] font-semibold text-[var(--text)]">
                  {formatPercent(reference.inputs.growthShare)}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">Risk capacity</dt>
                <dd className="tnum text-[16px] font-semibold text-[var(--text)]">
                  {Math.round(reference.inputs.riskCapacityScore * 100)}/100
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">Bond duration</dt>
                <dd className="tnum text-[16px] font-semibold text-[var(--text)]">
                  {reference.targetDuration.toFixed(1)}y
                </dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">Cost benchmark</dt>
                <dd className="tnum text-[16px] font-semibold text-[var(--text)]">
                  {formatPercent(reference.costBenchmark, 2)}
                </dd>
              </div>
            </dl>
          </Card>

          <Card className="p-5">
            <SectionHeading title="How every number above was derived" />
            <ol className="space-y-2.5">
              {reference.rationale.map((line, index) => (
                <li key={line} className="flex gap-3 text-[12.5px] leading-relaxed text-[var(--text-muted)]">
                  <span className="tnum mt-[1px] shrink-0 text-[11px] font-semibold text-[var(--accent-text)]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {line}
                </li>
              ))}
            </ol>
          </Card>

          <Card className="p-5">
            <SectionHeading
              title="Set the bond allocation directly"
              description="The glidepath estimates this from your horizon. Set it here to override."
            />
            <input
              type="range"
              min={0}
              max={90}
              step={5}
              value={Math.round((state.referenceOverrides.bondShare ?? reference.assetClass.bond) * 100)}
              onChange={(event) =>
                setReferenceOverrides({ ...state.referenceOverrides, bondShare: Number(event.target.value) / 100 })
              }
              className="w-full accent-[var(--accent)]"
              aria-label="Bond allocation"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="tnum text-[13px] text-[var(--text-muted)]">
                {formatPercent(reference.assetClass.bond)} bonds · {formatPercent(reference.inputs.growthShare)} growth ·{" "}
                {formatPercent(reference.assetClass.cash)} cash
              </span>
              {state.referenceOverrides.bondShare !== undefined ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    const next = { ...state.referenceOverrides };
                    delete next.bondShare;
                    setReferenceOverrides(next);
                  }}
                >
                  Back to the glidepath
                </Button>
              ) : null}
            </div>
          </Card>

          <Callout title="Why an index, rather than someone's opinion">
            Someone else maintains it, publishes it, and you can check it. Comparing against one needs no forecast and
            no view about what anyone ought to hold. Differences are positions you have taken — the point is finding out
            which ones you meant.
          </Callout>
        </div>
      </div>

      <ProjectionPanel
        report={report}
        realReturn={state.projectionOverrides.realReturn ?? null}
        onReturnChange={setProjectionReturn}
      />

      <Card className="flex flex-wrap items-center justify-between gap-4 p-6">
        <div className="max-w-xl">
          <h2 className="text-[16px] font-semibold text-[var(--text)]">
            {hasHoldings ? "Now see where your portfolio differs" : "Next: add what you actually hold"}
          </h2>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--text-muted)]">
            {hasHoldings
              ? "The gap report measures them against the reference above, ranked by how much of the portfolio each difference touches."
              : "Paste a list or add them one at a time. Nothing is uploaded — it all runs in this browser."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button href={hasHoldings ? "/analysis" : "/portfolio"}>
            {hasHoldings ? "See the gap report" : "Add your holdings"}
          </Button>
          {hasHoldings ? (
            <Button variant="secondary" href="/portfolio">
              Edit holdings
            </Button>
          ) : null}
        </div>
      </Card>

      <DisclaimerFooter />
    </div>
  );
}
