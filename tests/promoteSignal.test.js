import { test } from "node:test";
import assert from "node:assert/strict";
import { promoteSignal } from "../backend/ingestion/promoteSignal.js";
import { createMemoryIngestionAdapter } from "../backend/ingestion/adapters/memoryAdapter.js";

function makeAdapter() {
  const ctx = {
    cases: [],
    precase: [],
    seenPermalinks: new Set(),
    scrapeRuns: [],
  };
  return { ctx, adapter: createMemoryIngestionAdapter(ctx) };
}

test("rejects invalid signal and records precase status", async () => {
  const { ctx, adapter } = makeAdapter();
  const result = await promoteSignal(
    {
      title: "Hi",
      body: "test",
      permalink: "/r/test/comments/abc",
      subreddit: "r/test",
    },
    adapter
  );
  assert.equal(result.status, "rejected");
  assert.equal(ctx.precase[0].ai_status, "rejected");
  assert.equal(ctx.cases.length, 0);
});

test("skips duplicate permalink", async () => {
  const { adapter } = makeAdapter();
  await promoteSignal(
    {
      title: "Landlord kept my deposit without listing damages on move-out",
      body: "Three months waiting for return.",
      permalink: "/r/legaladvice/comments/dup1",
      subreddit: "r/legaladvice",
    },
    adapter
  );
  const second = await promoteSignal(
    {
      title: "Other",
      body: "Other body text here for length",
      permalink: "/r/legaladvice/comments/dup1",
      subreddit: "r/legaladvice",
    },
    adapter
  );
  assert.equal(second.status, "skipped");
});

test("promotes valid unique problem as published", async () => {
  const { ctx, adapter } = makeAdapter();
  const result = await promoteSignal(
    {
      title: "Bank added hidden monthly fees after I opened checking account",
      body: "Fees were not disclosed at signup and support will not remove them.",
      permalink: "/r/personalfinance/comments/new1",
      subreddit: "r/personalfinance",
    },
    adapter
  );
  assert.equal(result.status, "promoted");
  assert.equal(ctx.cases.length, 1);
  assert.equal(ctx.cases[0].status, "published");
  assert.equal(ctx.cases[0].source, "reddit");
  assert.ok(ctx.cases[0].permalinks[0].includes("reddit.com"));
});
