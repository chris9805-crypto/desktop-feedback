import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DisclaimerFooter } from "@/components/Disclaimer";
import { Card } from "@/components/ui";
import { ARTICLES, getArticle } from "@/lib/content/education";

export function generateStaticParams() {
  return ARTICLES.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return { title: "Not found" };
  return { title: article.title, description: article.summary };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const related = ARTICLES.filter((a) => a.topic === article.topic && a.slug !== article.slug).slice(0, 3);

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">
        {article.topic} · {article.readingMinutes} min read
      </p>
      <h1 className="mt-2 text-[26px] font-semibold leading-tight tracking-tight text-[var(--text)]">{article.title}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-muted)]">{article.summary}</p>

      <Card className="mt-7 p-5">
        <h2 className="text-[12px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">In short</h2>
        <ul className="mt-3 space-y-2">
          {article.keyPoints.map((point) => (
            <li key={point} className="flex gap-2.5 text-[13px] leading-relaxed text-[var(--text)]">
              <span className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-[var(--accent)]" aria-hidden="true" />
              {point}
            </li>
          ))}
        </ul>
      </Card>

      <article className="mt-9 space-y-8">
        {article.sections.map((section) => (
          <section key={section.heading}>
            <h2 className="text-[16px] font-semibold tracking-tight text-[var(--text)]">{section.heading}</h2>
            <div className="mt-3 space-y-3.5">
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 40)} className="text-[14px] leading-[1.7] text-[var(--text-muted)]">
                  {paragraph}
                </p>
              ))}
            </div>
          </section>
        ))}
      </article>

      {related.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-[13px] font-semibold text-[var(--text)]">More on {article.topic.toLowerCase()}</h2>
          <ul className="mt-3 space-y-2">
            {related.map((item) => (
              <li key={item.slug}>
                <Link href={`/learn/${item.slug}`} className="text-[13px] text-[var(--accent-text)] hover:underline">
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="mt-10 text-[12px]">
        <Link href="/learn" className="text-[var(--accent-text)] hover:underline">
          ← All topics
        </Link>
      </p>

      <DisclaimerFooter />
    </div>
  );
}
