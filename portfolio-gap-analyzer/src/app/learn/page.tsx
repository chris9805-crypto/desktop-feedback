import type { Metadata } from "next";
import Link from "next/link";
import { DisclaimerFooter } from "@/components/Disclaimer";
import { Card } from "@/components/ui";
import { ARTICLES } from "@/lib/content/education";

export const metadata: Metadata = {
  title: "Learn",
  description: "The concepts behind every check the gap report runs, written for people who hold stocks and ETFs.",
};

const TOPICS = ["Risk", "Diversification", "Cost", "Income", "Company analysis"] as const;

export default function LearnPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--text)]">Learn</h1>
        <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-[var(--text-muted)]">
          Every finding in the gap report links to one of these. They explain the idea behind a measure — what it
          captures, what it misses, and where the usual reasoning goes wrong — rather than telling you what to do about
          it.
        </p>
      </div>

      {TOPICS.map((topic) => {
        const articles = ARTICLES.filter((article) => article.topic === topic);
        if (articles.length === 0) return null;
        return (
          <section key={topic}>
            <h2 className="text-[15px] font-semibold tracking-tight text-[var(--text)]">{topic}</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {articles.map((article) => (
                <Link
                  key={article.slug}
                  href={`/learn/${article.slug}`}
                  className="card block p-4 transition-colors hover:border-[var(--border-strong)]"
                >
                  <h3 className="text-[13.5px] font-semibold text-[var(--text)]">{article.title}</h3>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--text-muted)]">{article.summary}</p>
                  <p className="mt-2.5 text-[11px] text-[var(--text-faint)]">{article.readingMinutes} min read</p>
                </Link>
              ))}
            </div>
          </section>
        );
      })}

      <Card className="p-5">
        <h2 className="text-[14px] font-semibold text-[var(--text)]">A note on what is missing</h2>
        <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-[var(--text-muted)]">
          These pages cover the concepts this tool measures. They do not cover choosing an account type, tax planning,
          estate planning, insurance, debt repayment or whether investing is the right use of your money at all — each
          of which can matter more than anything on this site, and none of which is something a screening tool can
          reason about for you.
        </p>
      </Card>

      <DisclaimerFooter />
    </div>
  );
}
