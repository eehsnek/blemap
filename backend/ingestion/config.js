/** @returns {'auto' | 'pending'} */
export function scrapePublishMode() {
  const mode = (process.env.SCRAPE_PUBLISH_MODE || "auto").toLowerCase();
  return mode === "pending" ? "pending" : "auto";
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
