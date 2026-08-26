import { fetchAllPosts, resolveScrapeSources } from "../scraper/fetchPosts.js";
import { assertScrapeAiReadyAsync } from "./config.js";
import { promoteSignal } from "./promoteSignal.js";

/**
 * @param {import('./adapters/types.js').IngestionAdapter} adapter
 * @param {{ limitPerSource?: number, maxPosts?: number, fetchPosts?: (n: number) => Promise<import('../scraper/types.js').ScrapePost[]> }} [opts]
 */
export async function runScrapeJob(adapter, opts = {}) {
  const aiBlock = await assertScrapeAiReadyAsync();
  if (aiBlock) return aiBlock;

  const limitPerSource = opts.limitPerSource ?? 4;
  const maxPosts = opts.maxPosts ?? 12;
  const fetchPosts = opts.fetchPosts ?? fetchAllPosts;
  const startedAt = new Date().toISOString();
  const sources = resolveScrapeSources();

  const stats = {
    scraped: 0,
    promoted: 0,
    rejected: 0,
    merged: 0,
    skipped: 0,
    sources,
    errors: [],
    started_at: startedAt,
  };

  let posts = [];
  try {
    posts = await fetchPosts(limitPerSource);
    stats.scraped = posts.length;
  } catch (err) {
    stats.errors.push({ stage: "fetch", message: err.message });
    await adapter.recordScrapeRun(stats);
    return stats;
  }

  const inserted = [];

  for (const post of posts.slice(0, maxPosts)) {
    try {
      const result = await promoteSignal(
        {
          title: post.title,
          body: post.selftext ?? "",
          permalink: post.permalink,
          subreddit: post.subreddit,
          source: post.source ?? "ingest",
        },
        adapter
      );

      if (result.status === "promoted") stats.promoted += 1;
      else if (result.status === "rejected") stats.rejected += 1;
      else if (result.status === "merged") stats.merged += 1;
      else if (result.status === "skipped") stats.skipped += 1;

      inserted.push({
        title: post.title,
        permalink: post.permalink,
        subreddit: post.subreddit,
        source: post.source,
        ai_status: result.status,
        reason: result.reason,
      });
    } catch (err) {
      stats.errors.push({
        permalink: post.permalink,
        message: err.message,
      });
    }
  }

  stats.inserted = inserted;
  stats.finished_at = new Date().toISOString();
  await adapter.recordScrapeRun(stats);
  return stats;
}
