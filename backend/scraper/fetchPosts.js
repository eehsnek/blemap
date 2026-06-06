import { hasOAuthCreds } from "./redditAuth.js";
import { scrapeAll } from "./reddit.js";
import { scrapeHackerNews } from "./hackernews.js";

/** @returns {string[]} */
export function resolveScrapeSources() {
  const raw = process.env.SCRAPE_SOURCES?.trim();
  if (raw) {
    return raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
  }
  const sources = ["hackernews"];
  if (hasOAuthCreds()) sources.push("reddit");
  return sources;
}

/**
 * Fetch posts from configured sources (HN free by default; Reddit if creds set).
 * @param {number} [limitPerSource=4]
 * @returns {Promise<import('./types.js').ScrapePost[]>}
 */
export async function fetchAllPosts(limitPerSource = 4) {
  const sources = resolveScrapeSources();
  const all = [];
  const seen = new Set();

  for (const source of sources) {
    let batch = [];
    try {
      if (source === "hackernews" || source === "hn") {
        batch = await scrapeHackerNews(limitPerSource);
      } else if (source === "reddit") {
        batch = await scrapeAll(limitPerSource);
      } else {
        console.warn(`Unknown scrape source: ${source}`);
        continue;
      }
    } catch (err) {
      console.warn(`Scrape source ${source} failed:`, err.message);
      continue;
    }

    for (const post of batch) {
      const key = post.permalink;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      all.push({
        ...post,
        source: post.source || source,
      });
    }
  }

  return all;
}
