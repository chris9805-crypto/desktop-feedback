import { describe, expect, it } from "vitest";
import { buildPie } from "@/lib/chart";

const data = (...values: number[]) => values.map((v, i) => ({ label: `s${i}`, value: v }));

describe("buildPie", () => {
  it("turns values into shares of the whole", () => {
    const pie = buildPie(data(50, 30, 20));
    expect(pie.wedges.map((w) => w.share)).toEqual([0.5, 0.3, 0.2]);
    expect(pie.wedges.reduce((a, w) => a + w.share, 0)).toBeCloseTo(1, 10);
  });

  it("orders wedges largest first", () => {
    const pie = buildPie(data(10, 60, 30));
    expect(pie.wedges.map((w) => w.value)).toEqual([60, 30, 10]);
  });

  it("gives each wedge its own palette slot, never a reused one", () => {
    const pie = buildPie(data(5, 4, 3, 2, 1));
    expect(pie.wedges.map((w) => w.colorIndex)).toEqual([0, 1, 2, 3, 4]);
  });

  it("folds the tail into Other rather than running out of hues", () => {
    const pie = buildPie(data(20, 15, 12, 10, 9, 8, 7, 6, 5, 4, 3));
    expect(pie.wedges).toHaveLength(8);
    const last = pie.wedges[pie.wedges.length - 1]!;
    expect(last.label).toBe("Other");
    expect(last.value).toBe(6 + 5 + 4 + 3);
    expect(pie.folded).toBe(true);
    expect(pie.wedges.reduce((a, w) => a + w.share, 0)).toBeCloseTo(1, 10);
  });

  it("leaves a short list unfolded", () => {
    expect(buildPie(data(1, 2, 3)).folded).toBe(false);
  });

  it("draws a single 100% category as a closed circle, not a degenerate arc", () => {
    const pie = buildPie([{ label: "United States", value: 1 }]);
    expect(pie.wedges).toHaveLength(1);
    // Two half-circle arcs; a 360-degree single arc would collapse to nothing.
    expect(pie.wedges[0]!.path.match(/A/g)).toHaveLength(2);
    expect(pie.wedges[0]!.path).not.toContain("NaN");
  });

  it("drops zero and negative values instead of drawing them", () => {
    const pie = buildPie([
      { label: "a", value: 60 },
      { label: "b", value: 0 },
      { label: "c", value: 40 },
    ]);
    expect(pie.wedges.map((w) => w.label)).toEqual(["a", "c"]);
  });

  it("survives an empty dataset", () => {
    const pie = buildPie([]);
    expect(pie.wedges).toEqual([]);
    expect(pie.total).toBe(0);
  });

  it("keeps every wedge inside the drawing", () => {
    const pie = buildPie(data(30, 25, 20, 15, 10), 200);
    for (const wedge of pie.wedges) {
      for (const n of wedge.path.match(/-?\d+(\.\d+)?/g) ?? []) {
        expect(Number(n)).toBeLessThanOrEqual(200);
        expect(Number(n)).toBeGreaterThanOrEqual(-1);
      }
    }
  });
});
