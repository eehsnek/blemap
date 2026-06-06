import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeHnItem } from "../backend/scraper/hackernews.js";
import { resolveScrapeSources } from "../backend/scraper/fetchPosts.js";

test("normalizeHnItem maps Ask HN text post", () => {
  const post = normalizeHnItem(
    {
      id: 42,
      type: "story",
      title: "How do I dispute a wrongful eviction notice?",
      text: "Landlord posted notice with no prior warning.",
    },
    "HN/Ask"
  );
  assert.ok(post);
  assert.equal(post.source, "hackernews");
  assert.equal(post.subreddit, "HN/Ask");
  assert.equal(post.permalink, "https://news.ycombinator.com/item?id=42");
  assert.match(post.selftext, /Landlord/i);
});

test("normalizeHnItem skips dead stories", () => {
  assert.equal(
    normalizeHnItem({ id: 1, type: "story", title: "x", dead: true }, "HN/New"),
    null
  );
});

test("resolveScrapeSources defaults to hackernews without reddit creds", () => {
  const prev = process.env.SCRAPE_SOURCES;
  const prevId = process.env.REDDIT_CLIENT_ID;
  delete process.env.SCRAPE_SOURCES;
  delete process.env.REDDIT_CLIENT_ID;
  delete process.env.REDDIT_CLIENT_SECRET;
  assert.deepEqual(resolveScrapeSources(), ["hackernews"]);
  if (prev) process.env.SCRAPE_SOURCES = prev;
  if (prevId) process.env.REDDIT_CLIENT_ID = prevId;
});
