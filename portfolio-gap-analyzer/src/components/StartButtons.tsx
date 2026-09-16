"use client";

import { useRouter } from "next/navigation";
import { useStore } from "@/lib/state/store";
import { Button } from "./ui";

export function StartButtons() {
  const { loadSample, hasHoldings } = useStore();
  const router = useRouter();

  return (
    <div className="flex flex-wrap gap-3">
      <Button href="/portfolio">{hasHoldings ? "Edit your holdings" : "Enter your holdings"}</Button>
      <Button
        variant="secondary"
        onClick={() => {
          loadSample();
          router.push("/analysis");
        }}
      >
        See it on an example portfolio
      </Button>
    </div>
  );
}

export function LoadSampleButton({ label = "Load the example portfolio" }: { label?: string }) {
  const { loadSample } = useStore();
  return (
    <Button variant="secondary" onClick={loadSample}>
      {label}
    </Button>
  );
}
