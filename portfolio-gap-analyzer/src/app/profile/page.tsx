"use client";

import { DisclaimerFooter } from "@/components/Disclaimer";
import { StackedBar } from "@/components/charts";
import { Button, Callout, Card, Field, SectionHeading, inputClass } from "@/components/ui";
import { ASSET_CLASSES, type Goal, type Region, type TaxWrapper } from "@/lib/engine/types";
import { formatPercent, label } from "@/lib/format";
import { useStore } from "@/lib/state/store";

const GOALS: Goal[] = ["retirement", "houseDeposit", "educationFund", "incomeNow", "generalGrowth"];
const REGIONS: Region[] = ["us", "uk", "europeExUk", "canada", "japan", "asiaPacificDeveloped", "emergingMarkets"];
const WRAPPERS: TaxWrapper[] = ["taxAdvantaged", "taxable", "mixed"];

const TOLERANCE_COPY: Record<number, string> = {
  1: "A fall of 10% would worry me enough to want out.",
  2: "I could sit through a 15% fall, but not comfortably.",
  3: "A 25% fall would be unpleasant and I would hold on.",
  4: "A 35% fall is the cost of doing business.",
  5: "A 50% fall would not change what I do.",
};

export default function ProfilePage() {
  const { state, report, setProfile, setReferenceOverrides } = useStore();
  const profile = state.profile;
  const reference = report.reference;

  const assetSlices = ASSET_CLASSES.filter((k) => reference.assetClass[k] > 0.001).map((k) => ({
    label: label(k),
    value: reference.assetClass[k],
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--text)]">Your situation</h1>
        <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-[var(--text-muted)]">
          These answers build the reference model your portfolio is compared against. They are not a suitability
          assessment and nobody is judging them — they are the inputs to an arithmetic model whose every step is shown
          on the right.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-6">
          <Card className="p-5">
            <SectionHeading title="The goal and its date" />
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
                  {REGIONS.map((region) => (
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
              title="Capacity for a bad year"
              description="Circumstances, not feelings. These decide how much volatility the plan can absorb without breaking."
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
              <Field label="Emergency buffer" hint="Months of essential spending held outside the portfolio">
                <input
                  className={inputClass}
                  type="number"
                  min={0}
                  max={24}
                  value={profile.emergencyFundMonths}
                  onChange={(event) => setProfile({ emergencyFundMonths: Math.max(0, Number(event.target.value) || 0) })}
                />
              </Field>
              <Field label="Annual withdrawal rate" hint="Percent of the portfolio you draw each year, 0 if none">
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
            <SectionHeading title="Tolerance for a bad year" description="How you would react, as opposed to what you could withstand." />
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
              {TOLERANCE_COPY[profile.riskTolerance]}
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
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <SectionHeading
              title="The reference model these answers produce"
              description="This is what your portfolio gets compared against. It is a comparison baseline, not a target anyone is setting for you."
            />
            <StackedBar slices={assetSlices} />
            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-[var(--border)] pt-4">
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
              title="Override the growth share"
              description="If you disagree with the derived figure, replace it. The rest of the model rebuilds around your number and says that it was set manually."
            />
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round((state.referenceOverrides.growthShare ?? reference.inputs.growthShare) * 100)}
              onChange={(event) => setReferenceOverrides({ ...state.referenceOverrides, growthShare: Number(event.target.value) / 100 })}
              className="w-full accent-[var(--accent)]"
              aria-label="Growth share override"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="tnum text-[13px] text-[var(--text-muted)]">
                {formatPercent(state.referenceOverrides.growthShare ?? reference.inputs.growthShare)} in growth assets
              </span>
              {state.referenceOverrides.growthShare !== undefined ? (
                <Button variant="ghost" onClick={() => setReferenceOverrides({})}>
                  Back to derived
                </Button>
              ) : null}
            </div>
          </Card>

          <Callout title="Why a market-anchored reference">
            The equity side of the model uses global market-capitalisation weights. That is not a view about what anyone
            should hold — it is what all investors collectively do hold, which makes it the one benchmark that requires
            no forecast to justify. Differences from it are positions you have taken, deliberately or otherwise.
          </Callout>

          <div className="flex gap-2">
            <Button href="/analysis">See the gap report</Button>
            <Button variant="secondary" href="/portfolio">
              Edit holdings
            </Button>
          </div>
        </div>
      </div>

      <DisclaimerFooter />
    </div>
  );
}
