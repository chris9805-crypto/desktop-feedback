import { describe, expect, it } from "vitest";
import { buildRangeChart, buildTwoLineChart } from "@/lib/chart";
import { allocationIllustration, feeIllustration } from "@/lib/engine/primer";

describe("allocation illustration", () => {
  const result = allocationIllustration();

  it("runs the mixes the primer claims to show", () => {
    expect(result.bands.map((b) => b.equityShare)).toEqual([0, 0.33, 0.67, 1]);
  });

  it("puts more shares on a higher expected return and a wider range", () => {
    for (let i = 1; i < result.bands.length; i++) {
      const previous = result.bands[i - 1]!;
      const band = result.bands[i]!;
      expect(band.realReturn).toBeGreaterThan(previous.realReturn);
      expect(band.volatility).toBeGreaterThan(previous.volatility);
      expect(band.p90 - band.p10).toBeGreaterThan(previous.p90 - previous.p10);
    }
  });

  it("shows the trade rather than a free lunch: the riskiest mix has the worst bad case", () => {
    const [none, , , all] = result.bands;
    expect(all!.roughBadYear).toBeLessThan(none!.roughBadYear);
    expect(all!.p50).toBeGreaterThan(none!.p50);
  });

  it("is deterministic, so the illustration does not change between renders", () => {
    expect(allocationIllustration().bands.map((b) => b.p50)).toEqual(result.bands.map((b) => b.p50));
  });

  it("reports what was actually paid in, so a band can be read against it", () => {
    expect(result.contributed).toBe(10000 + 300 * 12 * 30);
  });

  it("scales with the amount asked for", () => {
    const bigger = allocationIllustration({ amount: 100000, monthlyContribution: 0, years: 20 });
    expect(bigger.bands[3]!.p50).toBeGreaterThan(100000);
    expect(bigger.contributed).toBe(100000);
  });
});

describe("fee illustration", () => {
  const result = feeIllustration();

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
  const illustration = allocationIllustration();
  const chart = buildRangeChart(illustration.bands, "USD", illustration.contributed);

  it("draws one bar per band, inside the plot", () => {
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

  it("marks what was paid in when it fits on the axis", () => {
    expect(chart.contributed).not.toBeNull();
    expect(chart.contributed!.left).toBeGreaterThan(0);
    expect(chart.contributed!.left).toBeLessThan(100);
  });

  it("drops the paid-in marker rather than drawing it off the end", () => {
    expect(buildRangeChart(illustration.bands, "USD", 9e12).contributed).toBeNull();
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
