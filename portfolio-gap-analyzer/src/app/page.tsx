import Link from "next/link";
import { StartButtons } from "@/components/StartButtons";
import { Card, Callout } from "@/components/ui";
import { ARTICLES } from "@/lib/content/education";
import { DATASET_META } from "@/lib/data/dataset-meta";
import { DETECTORS } from "@/lib/engine/gaps";

const STEPS = [
  {
    title: "Map what you actually hold",
    body: "Paste your holdings. They resolve into exposure across asset class, region, sector, size, style, factor, credit and currency — then look through your funds to the companies underneath.",
  },
  {
    title: "Build a reference to compare against",
    body: "Pick an index, and your horizon and cash buffer size the rest. Every step of the derivation is shown, and every input is yours to change.",
  },
  {
    title: "Read the gaps, with the reasoning",
    body: "Each difference comes with the numbers, why the measure matters, and the routes for closing it — including deciding it was intentional.",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-14">
      <section className="pt-4">
        <p className="text-[12px] font-medium uppercase tracking-wider text-[var(--accent-text)]">
          Research and education for stock and ETF investors
        </p>
        <h1 className="mt-3 max-w-3xl text-[30px] font-semibold leading-[1.15] tracking-tight text-[var(--text)] sm:text-[38px]">
          Most portfolios have holes their owners never chose.
        </h1>
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[var(--text-muted)]">
          Not bad decisions — drift. A sector grows into a third of your equity without you buying more. Two funds
          bought years apart hold the same hundred companies. One stock hits double digits through index funds you never
          connected to it. Gapline finds those gaps and shows the arithmetic.
        </p>
        <div className="mt-7">
          <StartButtons />
        </div>
        <p className="mt-4 text-[12px] text-[var(--text-faint)]">
          Runs entirely in your browser. Your holdings are never sent anywhere.
        </p>
      </section>

      <section>
        <div className="grid gap-4 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <Card key={step.title} className="p-5">
              <div className="tnum text-[12px] font-semibold text-[var(--accent-text)]">0{index + 1}</div>
              <h2 className="mt-2 text-[14px] font-semibold text-[var(--text)]">{step.title}</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-muted)]">{step.body}</p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-[18px] font-semibold tracking-tight text-[var(--text)]">What it checks</h2>
        <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-[var(--text-muted)]">
          Nine families of checks, each reporting its own evidence — so you can disagree on the numbers, not on faith.
        </p>
        <ul className="mt-5 grid gap-x-8 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {DETECTORS.map((detector) => (
            <li key={detector.id} className="flex items-baseline gap-2.5 text-[13px] text-[var(--text-muted)]">
              <span className="h-1 w-1 shrink-0 translate-y-[-2px] rounded-full bg-[var(--accent)]" aria-hidden="true" />
              {detector.label}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-[18px] font-semibold tracking-tight text-[var(--text)]">What it deliberately is not</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Card className="p-5">
            <h3 className="text-[14px] font-semibold text-[var(--text)]">Not an adviser</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-muted)]">
              Personal investment advice requires a licence. This tool has none and pretends to none. It describes,
              compares and explains, and shows the filter criteria behind every instrument list.
            </p>
          </Card>
          <Card className="p-5">
            <h3 className="text-[14px] font-semibold text-[var(--text)]">Not a forecast</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-muted)]">
              No price targets, no ratings, no returns dressed up as projections. Assumed rates are labelled and shown.
              Past figures are described as history, because that is all they are.
            </p>
          </Card>
        </div>
      </section>

      <section>
        <h2 className="text-[18px] font-semibold tracking-tight text-[var(--text)]">Start with the concepts</h2>
        <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-[var(--text-muted)]">
          Every finding links to the idea behind it.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ARTICLES.slice(0, 6).map((article) => (
            <Link
              key={article.slug}
              href={`/learn/${article.slug}`}
              className="card block p-4 transition-colors hover:border-[var(--border-strong)]"
            >
              <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">{article.topic}</div>
              <h3 className="mt-1.5 text-[13.5px] font-semibold text-[var(--text)]">{article.title}</h3>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--text-muted)]">{article.summary}</p>
            </Link>
          ))}
        </div>
      </section>

      <Callout tone="warn" title="About the data in this build">
        {DATASET_META.warning} The dataset is dated {DATASET_META.asOf}.
      </Callout>
    </div>
  );
}
