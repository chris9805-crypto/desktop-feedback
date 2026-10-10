import { describe, expect, it } from "vitest";
import { buildRangeChart, buildTwoLineChart } from "@/lib/chart";
import { feeIllustration, goalPlan } from "@/lib/engine/primer";

describe("goal plan", () => {
  const plan = goalPlan();

  it("works backwards to a monthly payment for each mix", () => {
    expect(plan.mixes.map((m) => m.equityShare)).toEqual([0, 0.33, 0.67, 1]);
    for (const mix of plan.mixes) expect(mix.monthly).toBeGreaterThan(0);
  });

  it("asks less each month the more sits in shares", () => {
    const monthlies = plan.mixes.map((m) => m.monthly);
    for (let i = 1; i < monthlies.length; i++) expect(monthlies[i]!).toBeLessThan(monthlies[i - 1]!);
    expect(plan.leastPerMonth.id).toBe("all");
    expect(plan.mostPerMonth.id).toBe("none");
  });

  it("shows the trade: the plan that asks least can miss by most", () => {
    expect(plan.leastPerMonth.p10).toBeLessThan(plan.mostPerMonth.p10);
    expect(plan.leastPerMonth.p90).toBeGreaterThan(plan.mostPerMonth.p90);
  });

  it("lands the middle outcome near the goal, which is what the payment was sized for", () => {
    for (const mix of plan.mixes) {
      expect(mix.p50).toBeGreaterThan(plan.goal * 0.85);
      expect(mix.p50).toBeLessThan(plan.goal * 1.15);
    }
  });

  it("reports a shortfall rate near a coin flip rather than implying the goal is reached", () => {
    for (const mix of plan.mixes) {
      expect(mix.shortfall).toBeGreaterThan(0.3);
      expect(mix.shortfall).toBeLessThan(0.75);
    }
  });

  it("needs more each month under the dearer charge", () => {
    for (const mix of plan.mixes) {
      expect(mix.monthlyHighCharge).toBeGreaterThan(mix.monthly);
      expect(mix.monthlyExtra).toBe(mix.monthlyHighCharge - mix.monthly);
    }
    expect(plan.feeCostOverTerm).toBeCloseTo(plan.leastPerMonth.monthlyExtra * 12 * plan.years, 6);
  });

  it("falls short of the goal if the dearer charge is paid without raising the payment", () => {
    for (const mix of plan.mixes) expect(mix.highChargeOutcome).toBeLessThan(plan.goal);
  });

  it("rounds the payment to a figure someone would set up a standing order for", () => {
    for (const mix of plan.mixes) expect(mix.monthly % 5).toBe(0);
    expect(goalPlan({ goal: 5000000, years: 20, startingAmount: 0 }).mixes[0]!.monthly % 50).toBe(0);
  });

  it("says so when the starting sum already gets there on its own", () => {
    const rich = goalPlan({ goal: 20000, years: 30, startingAmount: 40000 });
    for (const mix of rich.mixes) {
      expect(mix.alreadyThere).toBe(true);
      expect(mix.monthly).toBe(0);
    }
  });

  it("is deterministic, so the answer does not move between renders", () => {
    expect(goalPlan().mixes.map((m) => [m.monthly, m.p10, m.shortfall])).toEqual(
      plan.mixes.map((m) => [m.monthly, m.p10, m.shortfall]),
    );
  });

  it("scales with the goal", () => {
    const bigger = goalPlan({ goal: 500000, years: 20, startingAmount: 5000 });
    expect(bigger.leastPerMonth.monthly).toBeGreaterThan(plan.leastPerMonth.monthly * 4);
  });
});

describe("fee illustration", () => {
  const result = feeIllustration();

  it("agrees with the goal plan it is drawn from", () => {
    const plan = goalPlan();
    const lead = plan.leastPerMonth;
    const fees = feeIllustration({
      amount: plan.startingAmount,
      monthlyContribution: lead.monthly,
      years: plan.years,
      growth: lead.realReturn,
      lowCharge: plan.lowCharge,
      highCharge: plan.highCharge,
    });
    // Same recurrence on both sides, so these are the same number twice.
    expect(fees.highEnd).toBeCloseTo(lead.highChargeOutcome, 4);
    // The payment was rounded up, so the cheap path clears the goal.
    expect(fees.lowEnd).toBeGreaterThanOrEqual(plan.goal);
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
  const plan = goalPlan();
  const chart = buildRangeChart(plan.mixes, "USD", plan.goal);

  it("draws one bar per mix, inside the plot", () => {
    expect(chart.bars).toHaveLength(4);
    for (const bar of chart.bars) {
      expect(bar.left).toBeGreaterThanOrEqual(0);
      expect(bar.left + bar.width).toBeLessThanOrEqual(100.01);
      expect(bar.medianLeft).toBeGreaterThanOrEqual(bar.left - 0.01);
      expect(bar.medianLeft).toBeLessThanOrEqual(bar.left + bar.width + 0.01);
    }
  });

  it("widens the bar as the mix gets bolder", () => {
    const widths = chart.bars.map((b) => b.width);
    for (let i = 1; i < widths.length; i++) expect(widths[i]!).toBeGreaterThan(widths[i - 1]!);
  });

  it("marks the goal", () => {
    expect(chart.marker).not.toBeNull();
    expect(chart.marker!.value).toBe(plan.goal);
    expect(chart.marker!.left).toBeGreaterThan(0);
    expect(chart.marker!.left).toBeLessThanOrEqual(100);
  });

  it("keeps the axis long enough to show a goal every band falls short of", () => {
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
