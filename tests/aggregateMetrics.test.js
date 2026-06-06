import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMetricsSummary, buildActivityFeed } from "../backend/lib/aggregateMetrics.js";
import { createMemoryStore } from "../backend/store/memoryStore.js";

test("buildMetricsSummary rolls up lifecycle and domain", () => {
  const cases = [
    { status: "published", lifecycle_state: "grey", domain: "law", source: "user", gap_score: 60, matrix_quadrant: "urgent_gap", created_at: new Date().toISOString() },
    { status: "published", lifecycle_state: "green", domain: "tech", source: "hackernews", gap_score: 20, matrix_quadrant: "saturated", created_at: new Date().toISOString() },
    { status: "pending", lifecycle_state: "grey", domain: "law", source: "user", gap_score: 40, created_at: new Date().toISOString() },
  ];
  const summary = buildMetricsSummary(cases, {
    lastScrapeRun: { scraped_count: 10, promoted_count: 2, merged_count: 1, rejected_count: 3, skipped_count: 4, finished_at: new Date().toISOString() },
    precaseByStatus: { promoted: 2, rejected: 1 },
  });
  assert.equal(summary.totals.cases, 3);
  assert.equal(summary.totals.published, 2);
  assert.equal(summary.byDomain.law, 2);
  assert.equal(summary.byQuadrant.urgent_gap, 1);
  assert.equal(summary.ingestFunnel.lastRun.promoted, 2);
});

test("memory store getMetricsSummary and getRecentActivity", async () => {
  const store = createMemoryStore();
  const summary = await store.getMetricsSummary();
  assert.ok(summary.totals.published >= 1);
  assert.ok(summary.byLifecycle);
  const activity = await store.getRecentActivity({ limit: 5 });
  assert.ok(Array.isArray(activity.items));
});

test("buildActivityFeed merges and sorts items", () => {
  const items = buildActivityFeed({
    caseEvents: [{ event_type: "confirmed", case_id: "a", topic: "Test", created_at: "2026-01-02T00:00:00Z" }],
    scrapeRuns: [{ promoted_count: 2, scraped_count: 5, finished_at: "2026-01-03T00:00:00Z" }],
    recentCases: [{ id: "b", topic: "New", created_at: "2026-01-01T00:00:00Z" }],
    limit: 10,
  });
  assert.equal(items[0].type, "scrape");
  assert.equal(items.length, 3);
});
