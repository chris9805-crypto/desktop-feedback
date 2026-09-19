# Gapline

An education and research tool for retail investors who hold stocks and ETFs.

It maps what a portfolio actually holds, compares it with a transparent
reference model built from the investor's own circumstances, and explains the
gaps between the two — with the arithmetic, the reasoning, and the ways each
gap could be closed.

It is deliberately **not** a financial adviser. It never says what anyone
should do with their money. See [COMPLIANCE.md](./COMPLIANCE.md) for how that
line is drawn and how it is enforced in code.

Needs Node 18.18 or newer (developed on 22). The app lives in this
subdirectory of the repo, so run everything from here.

```bash
npm install
npm run dev      # http://localhost:3000
npm run check    # typecheck + tests
```

To exercise the installable and offline behaviour you need a production build —
the service worker is deliberately not registered in development, where a
cached shell in front of the dev server makes hot reload confusing:

```bash
npm run build && npm start     # http://localhost:3000
```

Set `PORT` to use a different port, e.g. `PORT=4000 npm run dev`.

## The idea

Most portfolio problems are not bad decisions. They are drift.

A sector grows into a third of an equity sleeve because it performed well, and
nobody bought any more of it. Two funds bought years apart at different brokers
turn out to track the same index. A single company reaches double-digit weight
through three index funds that each hold it near the top. A bond sleeve bought
for safety turns out to be high-yield credit that falls with equities.

None of this is visible from a brokerage statement, because a statement lists
positions and these are properties of the *combination*. Gapline computes the
combination.

## What it does

**Maps the portfolio.** Holdings are resolved against a security master and
normalised into exposure across asset class, region, sector, size, style,
factor, credit and currency — then looked through funds to the individual
companies underneath them.

**Builds a reference to compare against.** Horizon, cash buffer, contributions
and income needs produce a reference model whose equity side is anchored on
global market-capitalisation weights. Every step of the derivation is shown in
plain English on the profile page, and every input can be overridden.

**Finds the gaps.** Nine detector families run against the difference:

| Family | What it looks for |
| --- | --- |
| Structure and horizon | volatility against the date the money is needed, cash drag, emergency buffer, bond duration, credit quality |
| Allocation | growth share, and region, sector and size weights against the reference |
| Concentration | single-company weight counted through funds, effective holdings, top-ten weight |
| Duplication | funds holding substantially the same thing, and the fee difference between them |
| Cost | weighted ongoing charge against a low-cost index benchmark, and cheaper equivalents per holding |
| Factor and style | tilts measured against what a broad index already carries |
| Income | withdrawals against distributions, and dividends with thin cover |
| Currency | exposure against the currency the money will be spent in |
| Company quality | leverage and valuation across directly held shares |

**Explains and offers routes.** Each finding carries its evidence, an
explanation of what the measure captures, a link to a longer article, and the
routes available for closing the gap — including deciding the gap was
intentional. Where instruments are listed, the screen criteria that produced
them are shown alongside.

## Architecture

```
src/
  lib/
    engine/          Pure TypeScript. No React, no I/O, no framework.
      types.ts       Domain model
      exposure.ts    Normalisation and value-weighted aggregation
      portfolio.ts   Holdings parsing, pricing, FX, deduplication
      metrics.ts     Risk model, look-through concentration
      reference.ts   The market-anchored reference model
      factors.ts     Factor loadings derived from published metrics
      scores.ts      Composite research scores
      implement.ts   Exposure screener and implementation routes
      gaps/          The nine detector families
      analyse.ts     Entry point: portfolio + profile -> report
    data/            Security master, FX, provider seam
    content/         Education articles
    state/           Client store (localStorage)
  components/        UI primitives, charts, finding cards
  app/               Next.js App Router pages
  test/              Vitest suites
```

The engine is a pure function of `(Portfolio, InvestorProfile) -> AnalysisReport`.
It has no dependency on React, the network or the DOM, which is why the whole
analysis can run client-side — and why it is straightforward to test.

### Two decisions worth knowing about

**Exposure maps are fractions of the whole security, not of a sleeve.** A 60/40
fund has sector weights summing to 0.60. Aggregating positions is then a plain
value-weighted sum, and "technology as a share of my portfolio" reads straight
off the total. Normalising to a sleeve is a presentation concern, handled at the
edge.

**Risk uses a single-factor model, not value-weighted volatility.** Each holding
splits into a market component (which adds up across holdings) and an
idiosyncratic one (which cancels out). Value-weighting each holding's own
volatility would ignore diversification entirely and overstate portfolio risk.

**Look-through concentration models the undisclosed tail.** Funds publish only
their largest holdings. The remainder of each fund is modelled as
`holdingsCount - disclosed` equally sized positions, which keeps the Herfindahl
index honest — without it, a 3,600-stock index fund would score as concentrated
as its ten largest holdings.

## Data

**The bundled security master is illustrative sample data.** 48 funds and 61
companies, hand-curated to be plausible and internally consistent, rounded,
and frozen at a single date. It exists so the engine can be exercised end to end
and so the interface has something real to render. It is not live market data,
and the app says so on every screen that uses it.

`src/lib/data/provider.ts` defines the seam. Replacing the sample data with a
live feed means implementing `MarketDataProvider` and nothing else — the engine,
the detectors and the UI are unaffected. The interface documentation notes the
two things a real implementation has to get right that the sample data papers
over: factsheet staleness on fund look-through, and keeping prices, fundamentals
and FX on a consistent as-of date.

## Installing it on a phone

Gapline is a progressive web app. On a phone, open it in the browser and use
"Add to Home Screen" (Safari) or the install prompt (Chrome); it then launches
standalone, without browser chrome.

It is genuinely usable offline, which falls out of the architecture rather than
being bolted on: the engine and the security master are both in the JavaScript
bundle and holdings live in `localStorage`, so once the shell is cached there is
nothing left to fetch. A full gap report can be produced with the network off.

`public/sw.js` handles caching — navigations network first, content-hashed
`/_next/static/` assets cache first, everything else stale-while-revalidate.

One detail worth knowing if you touch it: the first visit cannot be controlled
by a service worker, because it registers after that page has already fetched
its scripts. Precaching the routes alone therefore leaves their hashed chunks
uncached, and an offline cold start renders a blank page. Rather than
duplicating the build's asset manifest in the worker, the page reports what it
actually loaded and the worker stores it — correct across builds, with no build
step to keep in sync. `src/test/pwa.test.ts` guards the manifest, the icon set
and the worker's caching rules.

There is no native app. The engine is a pure function with no dependency on
React, the DOM or the network, so the analysis would port to React Native
unchanged if that were ever wanted; only the UI layer would be rewritten.

## Privacy

Holdings and the investor profile never leave the browser. The engine runs
client-side, state is persisted to `localStorage`, and there is no server
component to the analysis and no account to create. This is verifiable by
reading `src/lib/state/store.tsx`.

## Tests

```bash
npm test
```

70 tests across seven suites:

- **exposure** — normalisation invariants, aggregation, cash handling, duration weighting, look-through addition
- **portfolio** — the paste parser's sizing rules, FX conversion, cross-account merging, ticker aliases, unresolved holdings
- **reference** — allocation sums to one, growth share monotonic in horizon, risk capacity as a ceiling, home-tilt arithmetic
- **overlap** — same-index funds score as duplicates; a Nasdaq-100 fund does not score as a duplicate of an S&P 500 fund
- **gaps** — scenario portfolios produce the expected findings, ranking is ordered, no instrument is suggested that is already held, and a portfolio near its reference produces no manufactured findings
- **pwa** — the manifest carries what installability needs, every icon file exists, and the worker's caching rules hold
- **compliance** — advisory language is absent from both source and generated report text; findings carry evidence, reasoning and screen criteria

## Limitations

Stated plainly, because the report states them too:

- The bundled dataset is illustrative, not live.
- Fund look-through uses disclosed top holdings, so single-name concentration
  through funds is an estimate and a slight understatement.
- Momentum is not scored for directly held shares — it needs a trailing return
  series the dataset does not carry.
- The volatility model uses past three-year volatility and beta. Past volatility
  is a poor guide to the size of a crisis, and correlations move toward one when
  diversification is most needed.
- Tax is flagged as a consideration and never calculated.
- The universe is limited to the bundled securities; holdings outside it are
  reported as unresolved rather than silently dropped.
