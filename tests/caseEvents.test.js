import { test } from "node:test";
import assert from "node:assert/strict";
import { createMemoryStore } from "../backend/store/memoryStore.js";

test("confirmCase emits confirmed and published events", async () => {
  const store = createMemoryStore();
  const { draftId } = await store.analyzeSubmit({
    text: "Unique quokka warranty dispute with manufacturer refusing replacement parts.",
    userId: "u1",
  });
  const { case: c } = await store.confirmSubmit({ draftId, userId: "u1" });

  await store.confirmCase(c.id, "v1");
  const events = await store.getCaseEvents(c.id);
  assert.ok(events.some((e) => e.event_type === "confirmed"));
});

test("togglePain emits pain_added event", async () => {
  const store = createMemoryStore();
  const matrix = await store.listMatrixCases();
  const c = matrix[0];
  await store.togglePain(c.id, "pain-user");
  const events = await store.getCaseEvents(c.id);
  assert.ok(events.some((e) => e.event_type === "pain_added"));
  assert.ok(events.find((e) => e.event_type === "pain_added").metadata.gap_score != null);
});

test("toggleClaim emits claimed event", async () => {
  const store = createMemoryStore();
  const matrix = await store.listMatrixCases();
  const c = matrix.find((x) => !x.claimed_by);
  await store.toggleClaim(c.id, "claim-user");
  const events = await store.getCaseEvents(c.id);
  assert.ok(events.some((e) => e.event_type === "claimed"));
});
