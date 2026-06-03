import { test } from "node:test";
import assert from "node:assert/strict";
import { createMemoryStore } from "../backend/store/memoryStore.js";

test("listCases returns seed data", async () => {
  const store = createMemoryStore();
  const cases = await store.listCases();
  assert.ok(cases.length >= 4);
});

test("submitCase creates new case", async () => {
  const store = createMemoryStore();
  const result = await store.submitCase({
    text: "Completely unique quantum flux capacitor warranty issue",
  });
  assert.equal(result.matched, false);
  assert.ok(result.case.id);
});

test("togglePain increments and decrements", async () => {
  const store = createMemoryStore();
  const cases = await store.listCases();
  const id = cases[0].id;
  const userId = "user-test-1";

  const first = await store.togglePain(id, userId);
  assert.equal(first.state, "pained");

  const second = await store.togglePain(id, userId);
  assert.equal(second.state, "unpained");
});
