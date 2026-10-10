import { describe, expect, it } from "vitest";
import { buildFanChart, buildRangeChart, buildTwoLineChart } from "@/lib/chart";
import { RISK_TOLERANCES, feeIllustration, forecastAnswer, goalAnswer, riskMix } from "@/lib/engine/primer";
import { samplePaths, simulateOutcomes } from "@/lib/engine/projection";

describe("risk mix", () => {
  it("uses the same risk-to-shares mapping as the reference model", () => {
    expect(RISK_TOLERANCES.map((t) => riskMix(t).equityShare)).toEqual([0.25, 0.42, 0.6, 0.78, 0.92]);
  });

  it("names each band the way the reference model names it", () => {
    expect(RISK_TOLERANCES.map((t) => riskMix(t).label)).toEqual([
      "Defensive",
      "Cautious",
      "Balanced",
      "Growth",
      "Adventurous",
    ]);
  });

  it("raises both return and movement as the setting rises", () => {
    for (let i = 1; i < RISK_TOLERANCES.length; i++) {
      const previous = riskMix(RISK_TOLERANCES[i - 1]!);
      const mix = riskMix(RISK_TOLERANCES[i]!);
      expect(mix.realReturn).toBeGreaterThan(previous.realReturn);
      expect(mix.volatility).toBeGreaterThan(previous.volatility);
      expect(mix.roughBadYear).toBeLessThan(previous.roughBadYear);
    }
  });
});

describe("goal answer", () => {
  const answer = goalAnswer();

  it("answers the setting that was asked for", () => {
    expect(goalAnswer({ tolerance: 5 }).mix.tolerance).toBe(5);
    expect(answer.alternatives.filter((a) => a.chosen)).toHaveLength(1);
    expect(answer.alternatives.find((a) => a.chosen)!.tolerance).toBe(answer.mix.tolerance);
  });

  it("asks less each month the more movement is accepted", () => {
    const monthlies = answer.alternatives.map((a) => a.monthly!);
    for (let i = 1; i < monthlies.length; i++) expect(monthlies[i]!).toBeLessThan(monthlies[i - 1]!);
  });

  it("shows the trade: the setting that asks least lands lowest in a bad run", () => {
    const first = answer.alternatives[0]!;
    const last = answer.alternatives[answer.alternatives.length - 1]!;
    expect(last.monthly!).toBeLessThan(first.monthly!);
    expect(last.p10).toBeLessThan(first.p10);
    expect(last.p90).toBeGreaterThan(first.p90);
  });

  it("lands the middle outcome near the target the payment was sized for", () => {
    for (const option of answer.alternatives) {
      expect(option.p50).toBeGreaterThan(answer.goal * 0.85);
      expect(option.p50).toBeLessThan(answer.goal * 1.15);
    }
  });

  it("reports a shortfall near a coin flip rather than implying the target is reached", () => {
    expect(answer.shortfall).toBeGreaterThan(0.3);
    expect(answer.shortfall).toBeLessThan(0.75);
  });

  it("needs more each month under the dearer charge, and says what that totals", () => {
    expect(answer.monthlyHighCharge).toBeGreaterThan(answer.monthly);
    expect(answer.monthlyExtra).toBe(answer.monthlyHighCharge - answer.monthly);
    expect(answer.feeCostOverTerm).toBeCloseTo(answer.monthlyExtra * 12 * answer.years, 6);
  });

  it("falls short if the dearer charge is paid without raising the payment", () => {
    expect(answer.highChargeOutcome).toBeLessThan(answer.goal);
    expect(answer.shortBy).toBeCloseTo(answer.goal - answer.highChargeOutcome, 6);
  });

  it("counts what actually came out of pocket", () => {
    expect(answer.contributed).toBe(answer.startingAmount + answer.monthly * 12 * answer.years);
  });

  it("rounds the payment to a figure someone would set up a standing order for", () => {
    expect(answer.monthly % 5).toBe(0);
    expect(goalAnswer({ goal: 5000000, years: 20, startingAmount: 0 }).monthly % 50).toBe(0);
  });

  it("says so when the starting sum already gets there on its own", () => {
    const rich = goalAnswer({ goal: 20000, years: 30, startingAmount: 40000 });
    expect(rich.alreadyThere).toBe(true);
    expect(rich.monthly).toBe(0);
  });

  it("is deterministic, so the answer does not move between renders", () => {
    expect(goalAnswer().p10).toBe(answer.p10);
    expect(goalAnswer().shortfall).toBe(answer.shortfall);
  });
});

describe("forecast answer", () => {
  const answer = forecastAnswer();

  it("widens the range as the setting rises, without promising more", () => {
    const options = answer.alternatives;
    for (let i = 1; i < options.length; i++) {
      expect(options[i]!.p90 - options[i]!.p10).toBeGreaterThan(options[i - 1]!.p90 - options[i - 1]!.p10);
    }
    expect(options[options.length - 1]!.p10).toBeLessThan(options[0]!.p10);
  });

  it("counts what actually came out of pocket", () => {
    expect(answer.contributed).toBe(answer.startingAmount + answer.monthly * 12 * answer.years);
  });

  it("reports how often the plan finished below the money paid in", () => {
    expect(answer.belowContributed).toBeGreaterThan(0);
    expect(answer.belowContributed).toBeLessThan(0.5);
  });

  it("costs real money in a dearer fund, at every percentile", () => {
    expect(answer.dear.p10).toBeLessThan(answer.p10);
    expect(answer.dear.p50).toBeLessThan(answer.p50);
    expect(answer.dear.p90).toBeLessThan(answer.p90);
    expect(answer.feeCost).toBeCloseTo(answer.p50 - answer.dear.p50, 6);
    expect(answer.feeShare).toBeGreaterThan(0.05);
  });

  it("grows with a bigger monthly payment", () => {
    expect(forecastAnswer({ monthly: 600 }).p50).toBeGreaterThan(answer.p50);
  });

  it("is deterministic, so the answer does not move between renders", () => {
    expect(forecastAnswer().p50).toBe(answer.p50);
  });
});

describe("fee illustration", () => {
  const result = feeIllustration();

  it("agrees with the goal answer it is drawn from", () => {
    const answer = goalAnswer();
    const fees = feeIllustration({
      amount: answer.startingAmount,
      monthlyContribution: answer.monthly,
      years: answer.years,
      growth: answer.mix.realReturn,
      lowCharge: answer.lowCharge,
      highCharge: answer.highCharge,
    });
    // Same recurrence on both sides, so these are the same number twice.
    expect(fees.highEnd).toBeCloseTo(answer.highChargeOutcome, 4);
    // The payment was rounded up, so the cheap path clears the target.
    expect(fees.lowEnd).toBeGreaterThanOrEqual(answer.goal);
  });

  it("costs more the longer it runs, and by more than the headline charge", () => {
    // 1.35pp a year over 30 years is far more than 1.35% of the outcome.
    expect(result.shareOfOutcome).toBeGreaterThan(0.2);
    expect(result.difference).toBeGreaterThan(0);
  });

  it("separates the two paths monotonically", () => {
    let previousGap = -1;
    for (const point of result.points) {
      const gap = point.low - point.high;
      expect(gap).toBeGreaterThanOrEqual(previousGap);
      previousGap = gap;
    }
  });

  it("quotes the first-year charge, which is the number a reader is given", () => {
    expect(result.firstYearCharge).toBeCloseTo(10000 * 0.015, 6);
  });

  it("converts the gap into years of contributions", () => {
    expect(result.contributionYears).toBeCloseTo(result.difference / 3600, 6);
  });

  it("collapses to nothing when both charges are equal", () => {
    const equal = feeIllustration({ lowCharge: 0.003, highCharge: 0.003 });
    expect(equal.difference).toBeCloseTo(0, 6);
    expect(equal.contributionYears).toBeCloseTo(0, 6);
  });

  it("has no contribution-years figure when nothing is being paid in", () => {
    expect(feeIllustration({ monthlyContribution: 0 }).contributionYears).toBeNull();
  });
});

describe("range chart geometry", () => {
  const answer = goalAnswer();
  const chart = buildRangeChart(answer.alternatives, "USD", answer.goal);

  it("draws one bar per setting, inside the plot", () => {
    expect(chart.bars).toHaveLength(5);
    for (const bar of chart.bars) {
      expect(bar.left).toBeGreaterThanOrEqual(0);
      expect(bar.left + bar.width).toBeLessThanOrEqual(100.01);
      expect(bar.medianLeft).toBeGreaterThanOrEqual(bar.left - 0.01);
      expect(bar.medianLeft).toBeLessThanOrEqual(bar.left + bar.width + 0.01);
    }
  });

  it("widens the bar as the setting rises", () => {
    const widths = chart.bars.map((b) => b.width);
    for (let i = 1; i < widths.length; i++) expect(widths[i]!).toBeGreaterThan(widths[i - 1]!);
  });

  it("marks the target", () => {
    expect(chart.marker).not.toBeNull();
    expect(chart.marker!.value).toBe(answer.goal);
    expect(chart.marker!.left).toBeGreaterThan(0);
    expect(chart.marker!.left).toBeLessThanOrEqual(100);
  });

  it("keeps the axis long enough to show a target every band falls short of", () => {
    const missed = buildRangeChart([{ label: "x", p10: 10, p50: 20, p90: 30 }], "USD", 1000);
    expect(missed.marker).not.toBeNull();
    expect(missed.maxX).toBeGreaterThanOrEqual(1000);
  });

  it("labels the axis without a repeated value", () => {
    expect(chart.ticks[0]!.label).toBe("0");
    expect(chart.ticks[chart.ticks.length - 1]!.left).toBe(100);
    expect(new Set(chart.ticks.map((t) => t.label)).size).toBe(chart.ticks.length);
  });
});

describe("two-line chart geometry", () => {
  const chart = buildTwoLineChart(feeIllustration().points, "USD", 620, 240);

  it("keeps the cheaper path above the dearer one", () => {
    const fee = feeIllustration();
    const last = fee.points[fee.points.length - 1]!;
    expect(chart.yFor(last.low)).toBeLessThan(chart.yFor(last.high));
  });

  it("closes the gap area so it fills", () => {
    expect(chart.gapPath.endsWith("Z")).toBe(true);
    expect(chart.gapPath.startsWith("M")).toBe(true);
  });

  it("ends the x axis on the final year, exactly once", () => {
    const labels = chart.xTicks.map((t) => t.label);
    expect(labels[labels.length - 1]).toBe("30y");
    expect(labels.filter((l) => l === "30y")).toHaveLength(1);
  });

  it("puts the gap label between the two lines", () => {
    const fee = feeIllustration();
    const last = fee.points[fee.points.length - 1]!;
    expect(chart.gapLabel.y).toBeGreaterThan(chart.yFor(last.low));
    expect(chart.gapLabel.y).toBeLessThan(chart.yFor(last.high));
  });
});

describe("sample paths", () => {
  const input = { realReturn: 0.04, volatility: 0.12, years: 20, startValue: 5000, annualContribution: 3600 };

  it("returns whole runs, one value per year from today", () => {
    const paths = samplePaths(input, 7);
    expect(paths).toHaveLength(7);
    for (const path of paths) {
      expect(path).toHaveLength(21);
      expect(path[0]).toBe(5000);
    }
  });

  it("draws from the same distribution the band is drawn from", () => {
    // The sample is replayed from the simulator's own seed, so every sampled
    // run must sit inside the full run's extremes at the end.
    const points = simulateOutcomes(input);
    const final = points[20]!;
    const finals = samplePaths(input, 7).map((path) => path[20]!);
    expect(Math.min(...finals)).toBeLessThan(final.p50);
    expect(Math.max(...finals)).toBeGreaterThan(final.p50);
    // Picked between the 5th and 95th percentile, so none is an outlier.
    expect(Math.min(...finals)).toBeLessThanOrEqual(final.p10 * 1.05);
    expect(Math.max(...finals)).toBeGreaterThanOrEqual(final.p90 * 0.95);
  });

  it("spans the range rather than clustering", () => {
    const finals = samplePaths(input, 7).map((path) => path[20]!);
    const sorted = [...finals].sort((a, b) => a - b);
    expect(sorted[sorted.length - 1]! / sorted[0]!).toBeGreaterThan(2);
  });

  it("gives runs that are not straight lines", () => {
    // The whole reason for drawing them: at least one run must fall in some
    // year, or the picture would imply growth arrives smoothly.
    const paths = samplePaths(input, 7);
    const anyFall = paths.some((path) => path.some((value, year) => year > 0 && value < path[year - 1]!));
    expect(anyFall).toBe(true);
  });

  it("is deterministic", () => {
    expect(samplePaths(input, 7)).toEqual(samplePaths(input, 7));
  });
});

describe("journey", () => {
  it("rides along with both answers", () => {
    for (const answer of [goalAnswer(), forecastAnswer()]) {
      expect(answer.journey.points).toHaveLength(answer.years + 1);
      expect(answer.journey.paths).toHaveLength(7);
      expect(answer.journey.points[answer.years]!.p10).toBeCloseTo(answer.p10, 6);
      expect(answer.journey.points[answer.years]!.p90).toBeCloseTo(answer.p90, 6);
    }
  });

  it("is drawn with its runs inside the plot", () => {
    const answer = goalAnswer();
    const chart = buildFanChart(answer.journey.points, "USD", 640, 260, answer.journey.paths);
    expect(chart.pathLines).toHaveLength(7);
    const peak = Math.max(...answer.journey.paths.flat());
    expect(chart.maxY).toBeGreaterThanOrEqual(peak);
  });
});
