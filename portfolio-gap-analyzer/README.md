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

## Written for people with no finance background

Two things follow from that, and they shape the product rather than decorating it.

**Vocabulary is opt-in.** Terms of art carry a dotted underline; tapping one
opens a plain definition in a bar at the foot of the page — a bar rather than a
hover tooltip, because hover does not exist on a phone. The rule for writing a
definition: explain it to someone who has never bought an investment, without
using another term from the glossary unexplained.

**You do not need to own anything.** The landing tab is fully useful with an
empty portfolio: answer four plain questions and watch a sensible mix assemble
itself. Someone who does not know where to start has somewhere to start.

**And a fee checker**, because "don't blindly buy what your bank sells" is a
cost-literacy problem. Enter what you have been quoted and it converts the
percentage into money against a plain index portfolio. It says nothing about
whether the product is good — only what its charge costs.

## The flow

The tool opens on the **reference portfolio**, not on a form. That ordering is
deliberate: every "gap" it later reports is a difference from that model, so
the model is the thing worth understanding first. The landing tab explains what
a reference portfolio is, lets you pick the index behind it, lays out what it
holds region by region and sector by sector, shows the range it has
historically produced, and only then hands you over to enter your own holdings.

Start here → Reference → Holdings → Gap report, with Themes, Research and Learn
alongside.

## What it does

**Opens with the two decisions that come first.** Someone arriving usually wants
to know which fund to buy. That is the last question. The landing tab settles
the two that come before it, drawn on the reader's own starting sum, monthly
amount and horizon:

*How much sits in shares* — the same money run through four mixes, from none in
shares to all of it, each shown as the middle 80% of 2,000 simulated outcomes
with the median notched. On the defaults it makes the trade visible rather than
asserted: all-shares roughly **1.6× the middle outcome** of no-shares, and also
the **worst tenth of outcomes** of any mix on the board — below the two
intermediate mixes, and barely above the money paid in. No mix wins on both,
which is the entire lesson.

*What the holding costs* — two compounding paths under a 1.50% and a 0.15%
charge, with the widening gap shaded. A charge quoted as **$150 in year one**
comes to **$60,605 over 30 years**, 22% of what the cheaper version ends with,
or about 17 years of contributions. The shape is the argument: each year's
charge also gives up everything that money would have earned afterwards.

Both run the same simulator and the same compounding as the rest of the tool, so
the primer cannot carry a quieter set of assumptions than the pages it leads to.

**Maps the portfolio.** Holdings are resolved against a security master and
normalised into exposure across asset class, region, sector, size, style,
factor, credit and currency — then looked through funds to the individual
companies underneath them.

**Builds a reference to compare against.** The equity side is anchored on a
published index the user picks — **MSCI World** by default, or the S&P 500, or a
global all-cap index.

The growth/defensive split is the tightest of three independent limits: what
risk tolerance allows, what circumstances allow, and what the horizon allows.
Taking the minimum rather than blending is deliberate — each is a real limit on
its own terms, and averaging them lets a long horizon talk a cautious investor
into an allocation they will abandon in the first bad year. The model names
which limit bound, and the band it lands in (Defensive through Adventurous).
Across the tolerance range the defensive sleeve spans roughly 73% to 6%.

An inflation stance then decides what the defensive sleeve is *made of*, not how
big it is: nominal bonds only, or a third of it in index-linked bonds, or half
in linkers plus a capped commodity sleeve. Commodities are funded out of bonds
rather than equities, which makes that sleeve a less reliable equity cushion —
the model says so where it applies it. It can also be set directly as a bond
allocation. Every step of the derivation is shown in plain English on the
profile page, and every input can be overridden.

Because the choice of index changes what counts as a gap, the tool states each
one's blind spot before you commit to it: MSCI World holds no emerging markets,
so EM reads as an overweight against it rather than as a gap; the S&P 500 is a
single country, so no international gap can be found at all.

**Finds the gaps.** Nine detector families run against the difference:

| Family | What it looks for |
| --- | --- |
| Structure and horizon | volatility against the date the money is needed, cash drag, emergency buffer, bond duration, credit quality, inflation protection |
| Allocation | growth share, and region, sector and size weights against the reference |
| Concentration | single-company weight counted through funds, effective holdings, top-ten weight |
| Duplication | funds holding substantially the same thing, and the fee difference between them |
| Cost | weighted ongoing charge against a low-cost index benchmark, and cheaper equivalents per holding |
| Factor and style | tilts measured against what a broad index already carries |
| Income | withdrawals against distributions, and dividends with thin cover |
| Currency | exposure against the currency the money will be spent in |
| Company quality | leverage and valuation across directly held shares |

**Shows the range the reference has historically produced.** This sits on the
reference tab rather than the gap report, because it illustrates that mix and
not the holdings you own. A 2,000-path Monte
Carlo over the chosen index's long-run real return, reported as a 10th-to-90th
percentile band in today's money. It is an illustration, never a forecast: the
return assumption sits in a slider beside the chart, the model's own limits
(normal returns, no fat tails, no mean reversion) are printed with it, and it
illustrates the reference mix rather than the holdings you own.

**Leads with the five that matter most.** A full report can run to a dozen-plus
findings, which is more than anyone acts on. The five largest are shown up
front; the rest sit one click away rather than being dropped, because a lower
rank is not the same as unimportant.

**Builds thematic sleeves, and prices what they cost you.** AI infrastructure,
dividend growers, cybersecurity, energy transition, quality compounders,
defensive income. Each theme is a **rule over the same universe the screener
uses**, printed above its results — not a basket somebody vetted — and each
carries the argument against itself, because thematic funds are reliably most
popular after the theme has already run.

The part that makes it more than a thematic screener is underneath: tick some
names, set a sleeve size, and the page re-runs the whole analysis with the
sleeve funded pro-rata out of what is already held, then shows the difference —
top-ten weight, effective holdings, ongoing charge, modelled volatility, the
sectors that moved, and which gap findings the sleeve would introduce or clear.
A 5% AI sleeve that raises the tech weight 2pp and costs 1bp is a different
proposition from a 15% one that cuts effective holdings from 23 to 16, and the
page says which one you are looking at. Findings that drop off carry a note
saying a gap can disappear because the sleeve diluted it rather than because it
was fixed.

Funds are matched by looking through to their disclosed holdings, not by sector
weight alone: a cybersecurity fund is 88% information technology, so a bare
"60% tech" rule would pull it into the AI-infrastructure list where it does not
belong.

**Research, sortable.** Every column heading sorts the table — size, yield,
ongoing charge, 12-month return, and the quality, growth and valuation scores.
Numeric columns default to highest-first, and rows where a column does not
apply (a company has no ongoing charge, a fund has no quality score) show a
dash and sink to the bottom on either direction rather than jumping to the top.

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
      reference.ts   The index-anchored reference model
      presets.ts     MSCI World / S&P 500 / global all-cap index definitions
      projection.ts  Monte Carlo range for the reference mix
      primer.ts      The opening allocation and fee illustrations
      factors.ts     Factor loadings derived from published metrics
      scores.ts      Composite research scores
      themes.ts      Thematic screens: the rule, and the case against it
      theme-impact.ts  What a thematic sleeve does to the gap report
      implement.ts   Exposure screener and implementation routes
      gaps/          The nine detector families
      analyse.ts     Entry point: portfolio + profile -> report
    data/            Security master, trailing returns, FX, provider seam
    content/         Education articles and the plain-English glossary
    state/           Client store (localStorage)
    chart.ts         Fan, pie, range and two-line geometry, shared by both renderers
  components/        UI primitives, charts, finding cards
  app/               Next.js App Router pages
                     page.tsx is the landing tab: allocation and cost, before any ticker
                     reference/ the model, then the inputs behind it
                     themes/ builds a sleeve and diffs the report against it
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

**The categorical palette is validated, not eyeballed.** Both the light and dark
eight-hue sets clear the dataviz checks — lightness band, chroma floor,
colour-vision separation on adjacent slots, and contrast against their own
surface. Slot order is part of what passed: rotating the palette so a blue led
dropped adjacent green/orange separation to ΔE 2.8 for protanopes, so the
validated order stands over the cosmetic preference. Categories beyond eight
fold into "Other" rather than reusing a hue.

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

## The single-page artifact build

`npm run build:artifact` produces `artifact-build/gapline.html`: the whole tool
as one self-contained 236KB page, no framework and no network.

It exists because a Next.js static export cannot be published as a claude.ai
Artifact — artifact pages are served from a subpath and must reference their
files relatively, while Next emits root-absolute asset paths. Rather than
reimplement anything, `entry.ts` re-exports the engine, esbuild bundles it into
one IIFE, and `app.js` is a vanilla-JS interface over the same functions the
Next app calls. Analysis logic has exactly one home, so this build inherits
every fix made to it.

What it trades away against the Next app: no service worker, so no home-screen
install; and one URL instead of a route per page.

## Privacy

Holdings and the investor profile never leave the browser. The engine runs
client-side, state is persisted to `localStorage`, and there is no server
component to the analysis and no account to create. This is verifiable by
reading `src/lib/state/store.tsx`.

## Tests

```bash
npm test
```

120 tests across ten suites:

- **exposure** — normalisation invariants, aggregation, cash handling, duration weighting, look-through addition
- **portfolio** — the paste parser's sizing rules, FX conversion, cross-account merging, ticker aliases, unresolved holdings
- **reference** — allocation sums to one, growth share monotonic in horizon, risk capacity as a ceiling, home-tilt arithmetic
- **overlap** — same-index funds score as duplicates; a Nasdaq-100 fund does not score as a duplicate of an S&P 500 fund
- **gaps** — scenario portfolios produce the expected findings, ranking is ordered, no instrument is suggested that is already held, and a portfolio near its reference produces no manufactured findings
- **projection** — determinism, ordered percentiles, bands that widen with horizon and narrow with bonds
- **factors** — momentum ordering, bounds, and the recent-quarter penalty
- **fees** — a percentage converted to money, compounding counted, contributions included
- **pwa** — the manifest carries what installability needs, every icon file exists, and the worker's caching rules hold
- **compliance** — advisory language is absent from both source and generated report text; findings carry evidence, reasoning and screen criteria

## Limitations

Stated plainly, because the report states them too:

- The bundled dataset is illustrative, not live.
- Fund look-through uses disclosed top holdings, so single-name concentration
  through funds is an estimate and a slight understatement.
- Trailing returns are illustrative like the rest of the dataset, so the
  momentum column and the momentum factor loading are only as real as that.
- The volatility model uses past three-year volatility and beta. Past volatility
  is a poor guide to the size of a crisis, and correlations move toward one when
  diversification is most needed.
- Tax is flagged as a consideration and never calculated.
- The universe is limited to the bundled securities; holdings outside it are
  reported as unresolved rather than silently dropped.
