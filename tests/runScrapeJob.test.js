import { test } from "node:test";
import assert from "node:assert/strict";
import { runScrapeJob } from "../backend/ingestion/runScrapeJob.js";
import { createMemoryIngestionAdapter } from "../backend/ingestion/adapters/memoryAdapter.js";
import { assertScrapeAiReady } from "../backend/ingestion/config.js";

function makeAdapter() {
  const ctx = {
    cases: [],
    precase: [],
    seenPermalinks: new Set(),
    scrapeRuns: [],
  };
  return { ctx, adapter: createMemoryIngestionAdapter(ctx) };
}

test("production scrape requires GEMINI_API_KEY", () => {
  const prevEnv = process.env.NODE_ENV;
  const prevKey = process.env.GEMINI_API_KEY;
  process.env.NODE_ENV = "production";
  delete process.env.GEMINI_API_KEY;
  const block = assertScrapeAiReady();
  assert.ok(block?.error);
  process.env.NODE_ENV = prevEnv;
  if (prevKey) process.env.GEMINI_API_KEY = prevKey;
});

test("runScrapeJob aggregates stats with mocked fetch", async () => {
  const { ctx, adapter } = makeAdapter();
  const mockPosts = async () => [
    {
      title: "Neighbor plays loud music every night past quiet hours",
      selftext: "Building management ignores repeated complaints.",
      permalink: "https://news.ycombinator.com/item?id=1001",
      subreddit: "HN/Ask",
      source: "hackernews",
    },
    {
      title: "Hi",
      selftext: "",
      permalink: "https://news.ycombinator.com/item?id=1002",
      subreddit: "HN/New",
      source: "hackernews",
    },
  ];

  const result = await runScrapeJob(adapter, {
    fetchPosts: mockPosts,
    maxPosts: 2,
  });

  if (result.error) {
    assert.fail(result.error);
  }

  assert.equal(result.scraped, 2);
  assert.ok(result.promoted + result.rejected >= 1);
  assert.equal(ctx.scrapeRuns.length, 1);
});
