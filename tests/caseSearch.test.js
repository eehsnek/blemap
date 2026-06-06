import { test } from "node:test";
import assert from "node:assert/strict";
import { createMemoryStore } from "../backend/store/memoryStore.js";
import { applyCaseFilters } from "../backend/lib/caseFilters.js";

test("applyCaseFilters filters by q and domain", () => {
  const rows = [
    { topic: "Housing dispute", summary: "deposit", domain: "law" },
    { topic: "Bank fees", summary: "charges", domain: "finance" },
  ];
  const filtered = applyCaseFilters(rows, { q: "housing", domain: "law" });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].topic, "Housing dispute");
});

test("memory store listCases respects domain filter", async () => {
  const store = createMemoryStore();
  const lawOnly = await store.listCases(null, { filters: { domain: "law" } });
  assert.ok(lawOnly.every((c) => c.domain === "law"));
  assert.ok(lawOnly.length >= 1);
});

test("pagination limit works", () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({ topic: `Case ${i}` }));
  const page = applyCaseFilters(rows, { limit: 3, offset: 2 });
  assert.equal(page.length, 3);
  assert.equal(page[0].topic, "Case 2");
});
