# Staying a research tool, not an adviser

Giving personal investment advice is a licensed activity in every market this
tool could plausibly be used in. Gapline does not hold such a licence and is not
built to need one. That is a product constraint, not a footer — it changes what
the software is allowed to compute and say, so it is written down here and
enforced in code.

This document explains the line, how the design stays on the right side of it,
and what would cross it.

## The line

Roughly, and with the details differing by jurisdiction, the regulated activity
is making a **personal recommendation**: telling a specific person that a
specific investment is suitable *for them*. What is generally not regulated is
publishing factual information, generic education, and tools that describe a
portfolio without recommending action.

The distinction that matters most in practice is between:

- **"Your portfolio holds 52% information technology; the global market holds
  26%. Here is why sector concentration matters, and here is what the
  arithmetic is."** — description and education.
- **"You are overweight technology. You should sell QQQ and buy VXUS."** — a
  personal recommendation.

Gapline is built to produce only the first kind of statement, and a test fails
the build if it produces the second.

## Seven design decisions that keep it on the right side

### 1. The comparison baseline is an observable fact, not an opinion

The reference model's equity side is anchored on a **published index the user
chooses** — MSCI World by default, or the S&P 500, or a global all-cap index.
Each one is an observable, externally maintained set of weights, not a view
about what anyone should own. It lets the tool say "you differ from this index
here" without ever asserting that the index is the right holding for this
person.

Because the choice changes what counts as a gap, the tool states the
consequence of each one before the user commits to it: choosing MSCI World
means emerging-market holdings read as an overweight rather than as a gap,
and choosing the S&P 500 means no international gap can be found at all. A
baseline whose blind spots are hidden would be a worse baseline than none.

Where the model departs from pure market weights — the growth/defensive split,
the cash floor, bond duration — it does so through **arithmetic the user can
read and change**, and it shows the derivation step by step on the profile page
(`ReferenceModel.rationale`). A number the user can see the formula for and
override is a calculator output, not advice.

### 2. Findings describe differences; they do not prescribe

Every `Finding` carries `summary` (what the difference is, with numbers),
`why` (what the measure captures in general), and `evidence`. None of these
fields is permitted to contain an instruction. The `implementation` block is
phrased as *routes available*, always including the route **"Or decide the gap
is intentional"**, because a difference from a reference model genuinely is not
a mistake.

### 3. Instrument lists are screening results, with the screen attached

`ImplementationIdea.screen` always carries the **filter criteria** next to the
symbols it returned (`CandidateScreen.description`), and the UI renders the
criteria above the table. A bare list of tickers reads as a vetted shortlist;
a list with "funds with at least 60% emerging-market exposure, ranked by cost
then fund size" attached reads as what it is.

Candidates are ranked on **objective, checkable attributes** — ongoing charge,
fund size, spread — never on a prediction of return.

### 4. No forecasts, and every assumption is labelled

There are no price targets, no expected returns, and no ratings. Where an
illustration needs a rate of return — the cost-drag calculation, the cash-drag
comparison — the rate is **stated in the evidence line as an assumption**
("assuming a 5% gross return"), and the output is described as a difference
rather than as a projection of what the portfolio will be worth.

Past figures are described as history. The growth score is titled "Past growth"
and says in its own note that it is history, not a projection.

### 4b. Projections are illustrations of a range, never a forecast

Return projections are the most advice-adjacent thing this tool does, and the
part a regulator would look at hardest. Five constraints keep it on the
research side:

- **It is a band, not a number.** The output is the 10th to 90th percentile of
  2,000 simulated paths. The median is shown as one outcome among those paths,
  never as "what you will have". Removing the band and keeping the middle line
  would change the nature of the feature.
- **It is in today's money.** The return assumption is real rather than
  nominal, and contributions are assumed to rise with inflation. A nominal
  projection over thirty years produces a much larger and much less meaningful
  number.
- **The assumption is on the page and editable.** The real return sits in a
  slider next to the chart with its provenance stated, not buried in a
  footnote. A projection whose assumption the reader cannot see or change is
  just an impressive figure.
- **It illustrates the reference model, not the holdings.** The panel says so.
  Projecting the user's actual portfolio would edge toward a personalised
  outcome estimate.
- **The model's own limits are stated with it.** Returns are drawn
  independently from a normal distribution: no fat tails, no mean reversion, no
  sequence effects. That is written next to the chart, not in a disclaimer
  page.

The words "forecast", "prediction", "expected value" and "projection of your
portfolio" are avoided in the copy; the feature is described as an illustration
of a historical range.

### 5. Composite scores are summaries, shown with their inputs

The research scores (quality, financial strength, growth, valuation, dividend
durability) are arithmetic averages of published metrics on a fixed scale.
Each one renders **its components and their raw values directly beneath it**, and
carries a note saying what it does not capture. A score with its inputs visible
is a summary; a score without them is a rating, and ratings are a different
regulatory conversation.

Scores deliberately do not combine into a single overall number, because a
single number invites being read as a verdict.

### 6. The tool states what it cannot see

Every report ends with `caveats` — the illustrative dataset, unresolved
holdings, the limits of fund look-through, the absent momentum factor, the
assumptions in the volatility model, and the fact that tax is never calculated.
These are generated from the actual analysis run, not boilerplate, and they are
printed with the findings rather than hidden in a legal page.

A reader cannot judge a finding without knowing what was excluded from it.

### 7. Nothing leaves the browser

The engine is pure TypeScript and runs client-side against a bundled dataset.
Holdings and the investor profile are persisted to `localStorage` and are never
transmitted. This removes a whole category of data-protection surface, and it
means the privacy claim on the landing page can be verified by reading
`src/lib/state/store.tsx`.

## Enforcement

`src/test/compliance.test.ts` fails the build if advisory phrasing appears in
**either** the source tree or the generated text of reports run across several
different portfolios. The banned patterns cover:

| Pattern | Why it is banned |
| --- | --- |
| "you should" | tells the reader what to do |
| "we recommend", "I advise", "our recommendation" | a recommendation |
| "recommended allocation/portfolio/fund/stock" | presents output as a recommendation |
| "buy now", "sell it", "strong buy", "hold rating" | a trading call |
| "guaranteed return/profit/income" | promises an outcome |
| "will outperform", "will rise", "will fall" | forecasts a price move |
| "best stock/ETF/fund" | ranks instruments as universally best |
| "risk-free", "can't lose" | misdescribes investment risk |

Denials ("this is **not** financial advice") are allowed by an explicit
exception, since that copy is required rather than prohibited.

The same test also asserts the positive obligations: every finding must carry a
substantive `why`, at least one piece of evidence, and — where it shows
instruments — the screen criteria that produced them.

Two article sentences were reworded during development because they tripped
these rules. Both rewordings were improvements, which is a reasonable sign the
rules are set at about the right level.

## What would cross the line

For anyone extending this codebase, these are the changes that would turn it
into something needing a licence, or into something it should not be:

- Ranking candidate instruments by predicted return, or by any score that is
  implicitly a prediction.
- Turning the projection into a single number, making it nominal rather than
  real, hiding the return assumption, or running it over the user's actual
  holdings rather than the reference mix.
- Producing a single "recommended portfolio" output, or presenting the
  reference model as a target rather than a comparison baseline.
- Removing the "decide the gap is intentional" route, which is what keeps the
  implementation section a set of options rather than an instruction.
- Personalising the candidate screen on anything beyond objective constraints
  (currency, listing country, wrapper eligibility) — for example filtering by
  what the tool thinks would suit the user.
- Adding an overall portfolio score or grade.
- Sending holdings to a server, which changes both the privacy story and the
  regulatory posture.
- Calculating tax outcomes rather than flagging tax as a consideration.

## What this document is not

This is a description of the product's own design constraints. It is not legal
advice, and it does not certify that the tool is compliant in any particular
jurisdiction. Anyone deploying it commercially needs to take proper regulatory
advice for the markets they operate in — the rules differ, and the perimeter
around "guidance" versus "advice" has been moving for years.
