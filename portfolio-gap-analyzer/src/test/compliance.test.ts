import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { analysePortfolio } from "@/lib/engine/analyse";
import { buildPortfolio } from "@/lib/engine/portfolio";
import { BALANCED, DUPLICATED, TECH_HEAVY, profile } from "./fixtures";

/**
 * This product is a research and education tool. It is not a financial adviser
 * and is not licensed as one, so it must never tell anyone what to do with
 * their money. That line is easy to hold in the engine and easy to lose in a
 * stray line of interface copy, so it is enforced here rather than left to
 * review. COMPLIANCE.md explains the reasoning behind each rule.
 */
const BANNED: { pattern: RegExp; why: string }[] = [
  { pattern: /\byou should\b/i, why: "tells the reader what to do" },
  { pattern: /\b(we|i) (recommend|suggest you|advise)\b/i, why: "gives a recommendation" },
  { pattern: /\bour recommendation\b/i, why: "gives a recommendation" },
  { pattern: /\brecommended (allocation|portfolio|holding|fund|stock)\b/i, why: "presents output as a recommendation" },
  { pattern: /\b(strong )?(buy|sell) (now|this|these|it|rating)\b/i, why: "issues a trading call" },
  { pattern: /\bguaranteed? (return|profit|income)/i, why: "promises an outcome" },
  { pattern: /\bwill (outperform|beat the market|rise|fall|go up|go down)\b/i, why: "forecasts a price move" },
  { pattern: /\bbest (stock|etf|fund)s?\b/i, why: "ranks instruments as universally best" },
  { pattern: /\brisk[- ]free\b/i, why: "describes an investment as risk-free" },
  { pattern: /\bcan't lose\b/i, why: "promises an outcome" },
  { pattern: /\b(we|this) (forecast|predict)\b/i, why: "presents a projection as a forecast" },
  { pattern: /\byour portfolio will be worth\b/i, why: "states a future value as fact" },
];

/** "not financial advice" and similar denials are required copy, not violations. */
const ALLOWED_CONTEXT = /\b(not|isn't|is not|never|no)\b[^.]{0,40}\b(financial advice|recommendation|advice)\b/i;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (/\.(ts|tsx|js)$/.test(path) && !path.includes("compliance.test")) out.push(path);
  }
  return out;
}

/**
 * The published artifact ships its own copy of the interface text, so it has to
 * clear the same bar as the app. Its generated bundle is excluded — that is the
 * engine's own source, already covered by walking src/.
 */
function sourceFiles(): string[] {
  return [...walk(join(process.cwd(), "src")), join(process.cwd(), "artifact-build/app.js")];
}

describe("non-advisory language", () => {
  it("is absent from every source file, the published artifact included", () => {
    const violations: string[] = [];
    for (const path of sourceFiles()) {
      const contents = readFileSync(path, "utf8");
      contents.split("\n").forEach((line, index) => {
        if (ALLOWED_CONTEXT.test(line)) return;
        for (const rule of BANNED) {
          if (rule.pattern.test(line)) {
            violations.push(`${path.replace(process.cwd(), ".")}:${index + 1} — ${rule.why}: ${line.trim()}`);
          }
        }
      });
    }
    expect(violations).toEqual([]);
  });

  it("is absent from generated report copy across a range of portfolios", () => {
    const reports = [
      analysePortfolio(TECH_HEAVY(), profile()),
      analysePortfolio(DUPLICATED(), profile({ horizonYears: 3 })),
      analysePortfolio(BALANCED(), profile({ incomeNeedRate: 0.045, horizonYears: 2, emergencyFundMonths: 0 })),
      analysePortfolio(buildPortfolio([{ symbol: "HYG", value: 50000 }, { symbol: "TLT", value: 50000 }]), profile()),
    ];

    const text = reports
      .flatMap((r) => [
        ...r.caveats,
        ...r.reference.rationale,
        ...r.projection.notes,
        ...r.findings.flatMap((f) => [
          f.title,
          f.summary,
          f.why,
          ...f.evidence.map((e) => `${e.label} ${e.value} ${e.detail ?? ""}`),
          f.implementation?.objective ?? "",
          ...(f.implementation?.routes ?? []).map((route) => `${route.label} ${route.detail}`),
          ...(f.implementation?.tradeoffs ?? []),
          f.implementation?.screen?.description ?? "",
        ]),
      ])
      .filter(Boolean);

    for (const line of text) {
      if (ALLOWED_CONTEXT.test(line)) continue;
      for (const rule of BANNED) {
        expect(rule.pattern.test(line), `${rule.why}: ${line}`).toBe(false);
      }
    }
  });
});

describe("report completeness", () => {
  const report = analysePortfolio(TECH_HEAVY(), profile({ emergencyFundMonths: 1, incomeNeedRate: 0.03 }));

  it("explains why every finding matters, not just what it is", () => {
    expect(report.findings.length).toBeGreaterThan(3);
    for (const finding of report.findings) {
      expect(finding.why.length).toBeGreaterThan(80);
      expect(finding.evidence.length).toBeGreaterThan(0);
      expect(finding.severity).toBeGreaterThanOrEqual(1);
      expect(finding.severity).toBeLessThanOrEqual(100);
    }
  });

  it("shows the screen criteria whenever it shows candidate instruments", () => {
    for (const finding of report.findings) {
      const screen = finding.implementation?.screen;
      if (!screen) continue;
      expect(screen.description.length).toBeGreaterThan(20);
      expect(screen.symbols.length).toBeGreaterThan(0);
    }
  });

  it("always states what the analysis could not see", () => {
    expect(report.caveats.length).toBeGreaterThanOrEqual(3);
  });

  it("shows its working for the reference model", () => {
    expect(report.reference.rationale.length).toBeGreaterThanOrEqual(4);
  });

  it("presents the projection as a range with its limits attached", () => {
    const notes = report.projection.notes.join(" ");
    expect(report.projection.final.p10).toBeLessThan(report.projection.final.p90);
    expect(notes).toContain("not a forecast");
    expect(notes).toContain("today's money");
    // The reader has to be told it is not their own holdings being projected.
    expect(notes).toMatch(/reference mix, not the holdings/);
  });

  it("names the index the reference is built on, and what that index leaves out", () => {
    expect(report.reference.presetLabel.length).toBeGreaterThan(2);
    expect(report.reference.indexNote.length).toBeGreaterThan(40);
  });
});
