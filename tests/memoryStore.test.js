import { test } from "node:test";
import assert from "node:assert/strict";
import { createMemoryStore } from "../backend/store/memoryStore.js";
import { CONFIRMATIONS_REQUIRED } from "../backend/lib/caseMetrics.js";

test("listMatrixCases returns only published", async () => {
  const store = createMemoryStore();
  const matrix = await store.listMatrixCases();
  assert.ok(matrix.every((c) => c.status === "published"));
});

test("analyze and confirm creates pending case", async () => {
  const store = createMemoryStore();
  const { draftId, isValid } = await store.analyzeSubmit({
    text: "My unique zebra fence dispute with the city planning department refuses permits.",
    userId: "u1",
  });
  assert.equal(isValid, true);
  const result = await store.confirmSubmit({ draftId, userId: "u1" });
  assert.equal(result.pending, true);
  assert.equal(result.case.status, "pending");
});

test("confirmCase publishes after threshold", async () => {
  const store = createMemoryStore();
  const { draftId } = await store.analyzeSubmit({
    text: "Another unique yak rental agreement dispute with hidden fees every month.",
    userId: "u1",
  });
  const { case: c } = await store.confirmSubmit({ draftId, userId: "u1" });
  for (let i = 0; i < CONFIRMATIONS_REQUIRED; i++) {
    await store.confirmCase(c.id, `validator-${i}`);
  }
  const updated = await store.getCase(c.id);
  assert.equal(updated.status, "published");
});

test("getMetricsSummary returns prospector stats", async () => {
  const store = createMemoryStore();
  const m = await store.getMetricsSummary();
  assert.ok(m.prospector.unclaimed >= 0);
  assert.ok(m.byDomain);
});

test("getRecentActivity returns items array", async () => {
  const store = createMemoryStore();
  const { items } = await store.getRecentActivity({ limit: 5 });
  assert.ok(Array.isArray(items));
});
