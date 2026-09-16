import Link from "next/link";
import { StartButtons } from "@/components/StartButtons";
import { Card, Callout } from "@/components/ui";
import { ARTICLES } from "@/lib/content/education";
import { DATASET_META } from "@/lib/data/dataset-meta";
import { DETECTORS } from "@/lib/engine/gaps";

const STEPS = [
  {
    title: "Map what you actually hold",
    body: "Paste your holdings and the tool resolves them into exposure across asset class, region, sector, size, style, factor, credit and currency — then looks through your funds to the individual companies underneath them.",
  },
  {
    title: "Build a reference to compare against",
    body: "Your horizon, cash buffer, contributions and income needs produce a reference model anchored on global market weights. Every step of the derivation is shown in plain English, and every input is yours to change.",
  },
  {
    title: "Read the gaps, with the reasoning",
    body: "Each difference comes with the numbers behind it, an explanation of why that measure matters, and the routes available for closing it — including the route of deciding the gap was intentional.",
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
          Not because of bad decisions — because of drift. A sector grows into a third of your equity without you buying
          any more of it. Two funds you bought years apart turn out to hold the same hundred companies. A single stock
          reaches double-digit weight through index funds you never connected to it. Gapline finds those gaps, shows the
          arithmetic, and explains what each one means.
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
          Nine families of checks run against the difference between your portfolio and your reference model. Each one
          reports its own evidence, so you can disagree with a finding on the numbers rather than on faith.
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
              Giving personal investment advice requires a licence, and this tool does not have one or pretend to. It
              never tells you what to do with your money. It describes, compares and explains — and where it lists
              instruments, it shows the filter criteria that produced the list so you can judge the list for yourself.
            </p>
          </Card>
          <Card className="p-5">
            <h3 className="text-[14px] font-semibold text-[var(--text)]">Not a forecast</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-muted)]">
              No price targets, no expected returns dressed up as projections, no ratings. Where an illustration uses an
              assumed rate of return, it is labelled as an assumption and the rate is shown. Past figures are described
              as history, because that is all they are.
            </p>
          </Card>
        </div>
      </section>

      <section>
        <h2 className="text-[18px] font-semibold tracking-tight text-[var(--text)]">Start with the concepts</h2>
        <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-[var(--text-muted)]">
          Every finding links to the idea behind it. You can also read them on their own.
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
