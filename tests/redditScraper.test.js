import { test } from "node:test";
import assert from "node:assert/strict";
import { getRedditUserAgent } from "../backend/scraper/redditAuth.js";

test("reddit user agent is non-empty and descriptive", () => {
  const ua = getRedditUserAgent();
  assert.ok(ua.length > 10);
  assert.match(ua, /BleMap/i);
});
