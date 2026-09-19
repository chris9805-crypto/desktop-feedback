"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DisclaimerFooter } from "@/components/Disclaimer";
import { Button, Callout, Card, EmptyState, Field, Pill, SectionHeading, inputClass } from "@/components/ui";
import { normaliseSymbol, searchSecurities } from "@/lib/data/securities";
import { parseHoldings } from "@/lib/engine/portfolio";
import type { Currency, HoldingInput } from "@/lib/engine/types";
import { formatCurrency, formatPercent } from "@/lib/format";
import { useStore } from "@/lib/state/store";

const CURRENCIES: Currency[] = ["USD", "GBP", "EUR", "CHF", "CAD", "AUD", "JPY"];

const PLACEHOLDER = `VOO, 120
QQQ, $26,000
NVDA, 45
BND, 8%`;

export default function PortfolioPage() {
  const { state, report, setHoldings, setCash, setTotalValueHint, setProfile, loadSample, reset } = useStore();
  const [paste, setPaste] = useState("");
  const [pasteErrors, setPasteErrors] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [amount, setAmount] = useState("");
  const [amountKind, setAmountKind] = useState<"value" | "quantity">("value");

  const suggestions = useMemo(() => (query.length >= 1 ? searchSecurities(query, 6) : []), [query]);
  const usesPercent = state.holdings.some((h) => typeof h.percent === "number");
  const currency = state.profile.baseCurrency;

  function applyPaste(replace: boolean) {
    const { holdings, errors } = parseHoldings(paste);
    setPasteErrors(errors);
    if (holdings.length === 0) return;
    setHoldings(replace ? holdings : [...state.holdings, ...holdings]);
    setPaste("");
  }

  function addOne(symbol: string) {
    const numeric = Number(amount.replace(/[^\d.]/g, ""));
    const holding: HoldingInput = { symbol };
    if (Number.isFinite(numeric) && numeric > 0) {
      if (amountKind === "value") holding.value = numeric;
      else holding.quantity = numeric;
    }
    setHoldings([...state.holdings, holding]);
    setQuery("");
    setAmount("");
  }

  function removeSymbol(symbol: string) {
    setHoldings(state.holdings.filter((h) => normaliseSymbol(h.symbol) !== normaliseSymbol(symbol)));
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--text)]">Your holdings</h1>
        <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-[var(--text-muted)]">
          Paste a list or add positions one at a time. Nothing is uploaded and there is no account.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
        <Card className="p-5">
          <SectionHeading
            title="Paste a list"
            description="One per line. A bare number is shares, a currency symbol means a value, a percent sign means a share of the portfolio."
          />
          <textarea
            value={paste}
            onChange={(event) => setPaste(event.target.value)}
            placeholder={PLACEHOLDER}
            rows={7}
            spellCheck={false}
            className={`${inputClass} font-mono leading-relaxed`}
            aria-label="Holdings to paste"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => applyPaste(true)} disabled={paste.trim().length === 0}>
              Replace holdings
            </Button>
            <Button variant="secondary" onClick={() => applyPaste(false)} disabled={paste.trim().length === 0}>
              Add to existing
            </Button>
          </div>
          {pasteErrors.length > 0 ? (
            <div className="mt-4">
              <Callout tone="warn" title={`${pasteErrors.length} line${pasteErrors.length === 1 ? "" : "s"} could not be read`}>
                <ul className="space-y-1">
                  {pasteErrors.map((error) => (
                    <li key={error} className="font-mono text-[11.5px]">
                      {error}
                    </li>
                  ))}
                </ul>
              </Callout>
            </div>
          ) : null}
        </Card>

        <Card className="p-5">
          <SectionHeading title="Add one at a time" description="Search the bundled universe by ticker or name." />
          <div className="space-y-3">
            <Field label="Ticker or name">
              <input
                className={inputClass}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="VTI, Vanguard, Apple…"
                aria-label="Search securities"
              />
            </Field>
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <Field label={amountKind === "value" ? `Value (${currency})` : "Number of shares"}>
                <input
                  className={inputClass}
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  inputMode="decimal"
                  placeholder={amountKind === "value" ? "10000" : "120"}
                />
              </Field>
              <Field label="Sized by">
                <select
                  className={inputClass}
                  value={amountKind}
                  onChange={(event) => setAmountKind(event.target.value as "value" | "quantity")}
                >
                  <option value="value">Value</option>
                  <option value="quantity">Shares</option>
                </select>
              </Field>
            </div>
            {suggestions.length > 0 ? (
              <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
                {suggestions.map((security) => (
                  <li key={security.symbol}>
                    <button
                      type="button"
                      onClick={() => addOne(security.symbol)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-[var(--surface-2)]"
                    >
                      <span>
                        <span className="text-[12.5px] font-semibold text-[var(--text)]">{security.symbol}</span>
                        <span className="ml-2 text-[12px] text-[var(--text-muted)]">{security.name}</span>
                      </span>
                      <Pill tone={security.kind === "etf" ? "accent" : "neutral"}>
                        {security.kind === "etf" ? "ETF" : "Stock"}
                      </Pill>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <SectionHeading
          title="Account settings"
          description="Cash counts toward the portfolio. Base currency is what everything converts into."
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Uninvested cash" hint="Sitting in the account, not invested">
            <input
              className={inputClass}
              value={state.cash || ""}
              onChange={(event) => setCash(Number(event.target.value.replace(/[^\d.]/g, "")) || 0)}
              inputMode="decimal"
              placeholder="0"
            />
          </Field>
          <Field label="Base currency" hint="What you will spend the money in">
            <select
              className={inputClass}
              value={currency}
              onChange={(event) => setProfile({ baseCurrency: event.target.value as Currency })}
            >
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </Field>
          {usesPercent ? (
            <Field label="Approximate portfolio value" hint="Needed to price the holdings you entered as percentages">
              <input
                className={inputClass}
                value={state.totalValueHint || ""}
                onChange={(event) => setTotalValueHint(Number(event.target.value.replace(/[^\d.]/g, "")) || 0)}
                inputMode="decimal"
                placeholder="100000"
              />
            </Field>
          ) : null}
        </div>
      </Card>

      {state.holdings.length === 0 ? (
        <EmptyState
          title="Nothing to analyse yet"
          action={
            <Button variant="secondary" onClick={loadSample}>
              Load the example portfolio
            </Button>
          }
        >
          Add holdings above, or load an example to see what the report produces.
        </EmptyState>
      ) : (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3.5">
            <div>
              <h2 className="text-[14px] font-semibold text-[var(--text)]">
                {report.portfolio.positions.length} position{report.portfolio.positions.length === 1 ? "" : "s"}
              </h2>
              <p className="tnum mt-0.5 text-[12.5px] text-[var(--text-muted)]">
                {formatCurrency(report.portfolio.totalValue, currency)} total
                {state.cash > 0 ? `, including ${formatCurrency(state.cash, currency)} cash` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <Button href="/analysis">Open the gap report</Button>
              <Button variant="ghost" onClick={reset}>
                Clear
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
                  <th className="px-5 py-2.5 font-medium">Holding</th>
                  <th className="px-3 py-2.5 font-medium">Type</th>
                  <th className="px-3 py-2.5 text-right font-medium">Value</th>
                  <th className="px-3 py-2.5 text-right font-medium">Weight</th>
                  <th className="px-3 py-2.5 text-right font-medium">Charge</th>
                  <th className="px-5 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {report.portfolio.positions.map((position) => (
                  <tr key={position.symbol}>
                    <td className="px-5 py-2.5">
                      <Link href={`/research/${position.symbol}`} className="font-semibold text-[var(--text)] hover:underline">
                        {position.symbol}
                      </Link>
                      <div className="text-[12px] text-[var(--text-muted)]">{position.security.name}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Pill tone={position.security.kind === "etf" ? "accent" : "neutral"}>
                        {position.security.kind === "etf" ? "ETF" : "Stock"}
                      </Pill>
                    </td>
                    <td className="tnum px-3 py-2.5 text-right">{formatCurrency(position.value, currency)}</td>
                    <td className="tnum px-3 py-2.5 text-right font-medium">{formatPercent(position.weight)}</td>
                    <td className="tnum px-3 py-2.5 text-right text-[var(--text-muted)]">
                      {position.security.kind === "etf" ? formatPercent(position.security.fund.expenseRatio, 2) : "—"}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => removeSymbol(position.symbol)}
                        className="text-[12px] text-[var(--text-faint)] hover:text-[var(--over)]"
                        aria-label={`Remove ${position.symbol}`}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {state.cash > 0 ? (
                  <tr className="bg-[var(--surface-2)]">
                    <td className="px-5 py-2.5">
                      <span className="font-semibold text-[var(--text)]">Cash</span>
                      <div className="text-[12px] text-[var(--text-muted)]">Uninvested balance</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Pill>Cash</Pill>
                    </td>
                    <td className="tnum px-3 py-2.5 text-right">{formatCurrency(state.cash, currency)}</td>
                    <td className="tnum px-3 py-2.5 text-right font-medium">
                      {formatPercent(state.cash / Math.max(report.portfolio.totalValue, 1))}
                    </td>
                    <td className="px-3 py-2.5 text-right text-[var(--text-muted)]">—</td>
                    <td className="px-5 py-2.5"></td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {report.portfolio.unresolved.length > 0 ? (
            <div className="border-t border-[var(--border)] p-5">
              <Callout tone="warn" title="Not included in the analysis">
                <ul className="space-y-1">
                  {report.portfolio.unresolved.map((item) => (
                    <li key={`${item.raw}-${item.reason}`}>
                      <span className="font-mono text-[11.5px] font-semibold">{item.raw}</span>{" "}
                      {item.reason === "unknown-symbol"
                        ? "is not in the bundled security master, so it is missing from every weight below."
                        : "has no quantity, value or percentage, so it cannot be priced."}
                    </li>
                  ))}
                </ul>
              </Callout>
            </div>
          ) : null}
        </Card>
      )}

      <DisclaimerFooter />
    </div>
  );
}
