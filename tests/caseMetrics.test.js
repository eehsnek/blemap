import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeGapScore,
  computePainLevel,
  matrixQuadrant,
  enrichCase,
  stripSensitiveCaseFields,
} from "../backend/lib/caseMetrics.js";

test("high pain low solves yields high gap score", () => {
  const score = computeGapScore({
    pain_count: 15,
    solve_count: 0,
    has_solution: false,
  });
  assert.ok(score >= 50);
});

test("urgent quadrant when painful and unsolved", () => {
  const q = matrixQuadrant({
    pain_count: 10,
    solve_count: 0,
    lifecycle_state: "grey",
    solves: [],
  });
  assert.equal(q, "urgent_gap");
});

test("enrichCase adds gap_score and disclaimer for law", () => {
  const row = enrichCase({
    id: "1",
    topic: "Test",
    summary: "x",
    pain_count: 5,
    solve_count: 0,
    lifecycle_state: "grey",
    domain: "law",
    status: "published",
    confirmation_count: 5,
  });
  assert.ok(row.gap_score >= 0);
  assert.ok(row.disclaimer);
});

test("stripSensitiveCaseFields removes raw_input and embedding", () => {
  const stripped = stripSensitiveCaseFields({
    id: "1",
    topic: "Public topic",
    raw_input: "secret pasted text",
    embedding: [0.1, 0.2],
  });
  assert.equal(stripped.topic, "Public topic");
  assert.equal(stripped.raw_input, undefined);
  assert.equal(stripped.embedding, undefined);
});
