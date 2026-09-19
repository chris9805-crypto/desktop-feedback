import type { Metadata, Viewport } from "next";
import { DisclaimerGate } from "@/components/Disclaimer";
import { Nav } from "@/components/Nav";
import { TermBar } from "@/components/Term";
import { ServiceWorkerRegistration } from "@/components/ServiceWorker";
import { StoreProvider } from "@/lib/state/store";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Gapline — find the gaps in your portfolio",
    template: "%s · Gapline",
  },
  description:
    "An education and research tool for stock and ETF investors. It maps what your portfolio actually holds, compares it with a transparent reference model, and explains the gaps it finds.",
  applicationName: "Gapline",
  appleWebApp: {
    capable: true,
    title: "Gapline",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  // Matches the sticky nav's background so the status bar blends into it when
  // the app is launched from the home screen.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#141a22" },
  ],
  // No maximumScale or userScalable: pinch zoom stays available.
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StoreProvider>
          <ServiceWorkerRegistration />
          <DisclaimerGate />
          <Nav />
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
          <TermBar />
        </StoreProvider>
      </body>
    </html>
  );
}
