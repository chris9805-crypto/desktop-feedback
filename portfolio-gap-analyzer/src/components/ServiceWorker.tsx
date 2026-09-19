"use client";

import { useEffect } from "react";

/** Same-origin build assets this page loaded, which the worker should keep for offline use. */
function loadedAssetUrls(): string[] {
  const urls = new Set<string>();

  for (const element of document.querySelectorAll<HTMLScriptElement | HTMLLinkElement>(
    'script[src], link[rel="stylesheet"][href]',
  )) {
    const url = "src" in element ? element.src : element.href;
    if (url) urls.add(url);
  }

  // Resource timings also catch chunks pulled in by dynamic import and by
  // Next's route prefetching, which are not in the markup.
  for (const entry of performance.getEntriesByType("resource")) {
    if (entry.name.includes("/_next/static/")) urls.add(entry.name);
  }

  return [...urls].filter((url) => url.startsWith(window.location.origin));
}

/**
 * Registers the service worker that makes Gapline installable and usable
 * offline. Development is excluded deliberately: a cached shell in front of
 * the dev server produces confusing stale-asset behaviour during hot reload.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js");
        const ready = await navigator.serviceWorker.ready;
        if (cancelled) return;
        // This page's own assets were fetched before the worker took control,
        // so hand them over explicitly or they never reach the cache.
        ready.active?.postMessage({ type: "warm", urls: loadedAssetUrls() });
      } catch {
        // Registration fails on insecure origins and where the user has
        // blocked site data. The app works fine without it, just online-only.
      }
    };

    // Registering after load keeps the worker's install fetches from competing
    // with the ones the first page render actually needs.
    if (document.readyState === "complete") void register();
    else window.addEventListener("load", () => void register(), { once: true });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
