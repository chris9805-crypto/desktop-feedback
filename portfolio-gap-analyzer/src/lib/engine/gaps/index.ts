import type { Finding } from "../types";
import { allocationFindings } from "./allocation";
import { concentrationFindings } from "./concentration";
import { costFindings } from "./cost";
import { currencyFindings } from "./currency";
import { factorFindings } from "./factor";
import { incomeFindings } from "./income";
import { overlapFindings } from "./overlap";
import { qualityFindings } from "./quality";
import { structureFindings } from "./structure";
import type { GapContext } from "./context";

export type Detector = (ctx: GapContext) => Finding[];

/** Every check the engine runs, in the order they are described in the report. */
export const DETECTORS: { id: string; label: string; run: Detector }[] = [
  { id: "structure", label: "Structure and horizon", run: structureFindings },
  { id: "allocation", label: "Allocation against the reference", run: allocationFindings },
  { id: "concentration", label: "Concentration through funds", run: concentrationFindings },
  { id: "overlap", label: "Duplicated exposure", run: overlapFindings },
  { id: "cost", label: "Ongoing charges", run: costFindings },
  { id: "factor", label: "Factor and style tilts", run: factorFindings },
  { id: "income", label: "Income", run: incomeFindings },
  { id: "currency", label: "Currency", run: currencyFindings },
  { id: "quality", label: "Directly held companies", run: qualityFindings },
];

export function runDetectors(ctx: GapContext): Finding[] {
  const findings: Finding[] = [];
  for (const detector of DETECTORS) {
    findings.push(...detector.run(ctx));
  }
  return findings.sort((a, b) => b.severity - a.severity);
}

export { type GapContext } from "./context";
