import { pingGemini } from "../lib/geminiPing.js";

/** @returns {'auto' | 'pending'} */
export function scrapePublishMode() {
  // Default pending so scraped cases need community confirmation (SR-04).
  // Set SCRAPE_PUBLISH_MODE=auto explicitly for demos that want immediate publish.
  const mode = (process.env.SCRAPE_PUBLISH_MODE || "pending").toLowerCase();
  return mode === "auto" ? "auto" : "pending";
}

/** Production scrape requires Gemini; dev can use heuristic fallback. */
export function assertScrapeAiReady() {
  if (process.env.GEMINI_API_KEY?.trim()) return null;
  if (process.env.NODE_ENV === "production") {
    return {
      error:
        "GEMINI_API_KEY is required for automated scraping in production. Add it in your host environment.",
      status: 503,
    };
  }
  return null;
}

/** Sync key check + optional live Gemini ping in production (W3-C). */
export async function assertScrapeAiReadyAsync() {
  const sync = assertScrapeAiReady();
  if (sync) return sync;
  if (process.env.NODE_ENV === "production" && process.env.GEMINI_API_KEY?.trim()) {
    const ping = await pingGemini();
    if (ping.status === "fail") {
      return {
        error: `Gemini model unavailable (${ping.model}): ${ping.error || "fail"}`,
        status: 503,
      };
    }
  }
  return null;
}
