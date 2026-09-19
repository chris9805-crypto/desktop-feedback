"use client";

import { useState } from "react";
import { Term } from "@/components/Term";
import { Callout, Card, Field, SectionHeading, inputClass } from "@/components/ui";
import { compareFees } from "@/lib/engine/fees";
import type { Currency } from "@/lib/engine/types";
import { formatCurrency, formatPercent } from "@/lib/format";

/**
 * Turns a quoted charge into money.
 *
 * Aimed squarely at someone who has been shown a product and does not know
 * whether 1.4% a year is normal. It compares like for like against a plain
 * index portfolio and says nothing about whether the product is any good —
 * only what its charge costs over the time the money is invested.
 */
export function FeeCheck({ currency }: { currency: Currency }) {
  const [amount, setAmount] = useState(25000);
  const [monthly, setMonthly] = useState(250);
  const [charge, setCharge] = useState(1.4);
  const [years, setYears] = useState(25);

  const result = compareFees({
    amount,
    monthlyContribution: monthly,
    offeredCharge: charge / 100,
    years,
  });

  return (
    <Card className="p-5">
      <SectionHeading
        title="Been offered something? Check what the charge costs"
        description="Funds and advisers quote fees as a percentage, which is the hardest possible unit to judge. This converts one into money."
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <Field label={`Amount (${currency})`} hint="What you would put in now">
          <input
            className={inputClass}
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
          />
        </Field>
        <Field label="Added each month" hint="Leave at 0 for a lump sum">
          <input
            className={inputClass}
            type="number"
            min={0}
            value={monthly}
            onChange={(e) => setMonthly(Math.max(0, Number(e.target.value) || 0))}
          />
        </Field>
        <Field label="Their annual charge (%)" hint="Add platform and adviser fees too">
          <input
            className={inputClass}
            type="number"
            min={0}
            max={10}
            step={0.05}
            value={charge}
            onChange={(e) => setCharge(Math.max(0, Number(e.target.value) || 0))}
          />
        </Field>
        <Field label="Years invested" hint="Until you need the money">
          <input
            className={inputClass}
            type="number"
            min={1}
            max={50}
            value={years}
            onChange={(e) => setYears(Math.max(1, Number(e.target.value) || 1))}
          />
        </Field>
      </div>

      <div className="mt-5 grid gap-4 border-t border-[var(--border)] pt-5 sm:grid-cols-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
            At {formatPercent(charge / 100, 2)} a year
          </div>
          <div className="tnum mt-1 text-[20px] font-semibold text-[var(--over)]">
            {formatCurrency(result.offered.endValue, currency)}
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
            At 0.15% — a plain <Term k="indexFund">index fund</Term>
          </div>
          <div className="tnum mt-1 text-[20px] font-semibold text-[var(--under)]">
            {formatCurrency(result.lowCost.endValue, currency)}
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">Difference</div>
          <div className="tnum mt-1 text-[20px] font-semibold">{formatCurrency(result.difference, currency)}</div>
          <div className="mt-1 text-[12px] text-[var(--text-muted)]">
            {formatPercent(result.shareOfOutcome, 0)} of what you would otherwise have
          </div>
        </div>
      </div>

      <p className="mt-4 text-[13px] leading-relaxed text-[var(--text-muted)]">
        The charge looks like {formatCurrency(result.firstYearCharge, currency)} in the first year. Over {years} years,
        the gap is {formatCurrency(result.difference, currency)} — because each year&apos;s charge also stops earning
        for every year after it.
      </p>

      <div className="mt-4">
        <Callout tone="warn" title="What this does and does not tell you">
          <ul className="space-y-1.5">
            <li>
              It shows the cost of a charge, not whether the product is any good. Some charges buy something; most of
              this one&apos;s cost is certain either way.
            </li>
            <li>Both sides assume the same 5% return before charges, so only the fee differs. Real returns will not be 5%.</li>
            <li>
              Ask what the <em>total</em> is: fund charge, platform fee and adviser fee stack, and are often quoted
              separately.
            </li>
          </ul>
        </Callout>
      </div>
    </Card>
  );
}
