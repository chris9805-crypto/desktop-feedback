import type { Metadata } from "next";
import { DisclaimerGate } from "@/components/Disclaimer";
import { Nav } from "@/components/Nav";
import { StoreProvider } from "@/lib/state/store";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Gapline — find the gaps in your portfolio",
    template: "%s · Gapline",
  },
  description:
    "An education and research tool for stock and ETF investors. It maps what your portfolio actually holds, compares it with a transparent reference model, and explains the gaps it finds.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StoreProvider>
          <DisclaimerGate />
          <Nav />
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        </StoreProvider>
      </body>
    </html>
  );
}
