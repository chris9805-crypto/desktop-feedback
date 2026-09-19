import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gapline — portfolio gap analysis",
    short_name: "Gapline",
    description:
      "Map what your stock and ETF portfolio actually holds, compare it with a transparent reference model, and read the gaps with the reasoning behind them.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f6f7f9",
    theme_color: "#ffffff",
    categories: ["finance", "education"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Platforms crop maskable icons to their own shape, so this one runs to
      // the full bleed with the mark inside the inner 80% safe zone.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Gap report", short_name: "Report", url: "/analysis" },
      { name: "Edit holdings", short_name: "Holdings", url: "/portfolio" },
    ],
  };
}
