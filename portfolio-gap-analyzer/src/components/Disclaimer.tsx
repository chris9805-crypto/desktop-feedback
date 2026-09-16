"use client";

import { DATASET_META } from "@/lib/data/dataset-meta";
import { useStore } from "@/lib/state/store";
import { Button } from "./ui";

/**
 * Shown once, up front, and acknowledged before the tool is used.
 *
 * This is a research and education product, not a regulated advice service.
 * Saying so in a footer is not enough: the distinction changes how every
 * number on every screen should be read, so it is put in front of the reader
 * before they see any of them.
 */
export function DisclaimerGate() {
  const { state, acceptDisclaimer, loading } = useStore();
  if (loading || state.disclaimerAccepted) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" role="dialog" aria-modal="true" aria-labelledby="disclaimer-title">
      <div className="card max-h-[90vh] w-full max-w-lg overflow-y-auto p-6">
        <h2 id="disclaimer-title" className="text-[16px] font-semibold text-[var(--text)]">
          Before you start
        </h2>
        <div className="mt-3 space-y-3 text-[13px] leading-relaxed text-[var(--text-muted)]">
          <p>
            <strong className="font-semibold text-[var(--text)]">This is a research and education tool.</strong> It
            describes what a portfolio holds, compares it with a reference model built from figures you supply, and
            explains the concepts behind the differences it finds.
          </p>
          <p>
            It is <strong className="font-semibold text-[var(--text)]">not a financial adviser</strong> and gives no
            personal recommendations. Nothing here is a suggestion to buy or dispose of any investment. Where it lists
            instruments, it is showing the results of a filter over a fund universe and the criteria used — that is a
            screening result, not a shortlist anyone has vetted for you.
          </p>
          <p>
            The reference model it compares against is anchored on global market weights and on your own answers. Every
            input is visible and editable. A difference from it is information, not a verdict.
          </p>
          <p className="rounded-lg border border-[var(--warn)]/30 bg-[var(--warn-soft)] px-3 py-2 text-[var(--text)]">
            {DATASET_META.warning}
          </p>
          <p>
            Your holdings and answers stay in this browser. They are saved to local storage on this device and are not
            sent anywhere.
          </p>
        </div>
        <div className="mt-5 flex justify-end">
          <Button onClick={acceptDisclaimer}>I understand</Button>
        </div>
      </div>
    </div>
  );
}

/** The standing reminder, repeated at the foot of every report-bearing page. */
export function DisclaimerFooter() {
  return (
    <p className="mt-10 border-t border-[var(--border)] pt-5 text-[11.5px] leading-relaxed text-[var(--text-faint)]">
      Gapline is a research and education tool. It is not a financial adviser, it does not provide personal
      recommendations, and nothing it produces is a suggestion to buy or dispose of any investment. Instrument lists are
      the output of a filter over a fund universe, shown with the criteria that produced them. Figures in this build are
      illustrative sample data, not live market data. Tax treatment depends on your own circumstances and your
      country&apos;s rules. If you want advice on your particular situation, speak to someone licensed to give it.
    </p>
  );
}
