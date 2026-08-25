import test from "node:test";
import assert from "node:assert/strict";
import { cosineSimilarity, parseEmbedding } from "../backend/lib/similarity.js";
import { findSimilarCases } from "../backend/services/caseSimilarity.js";
import { duplicateFromMatches } from "../backend/services/caseSimilarity.js";

test("cosineSimilarity is 1 for identical vectors", () => {
  assert.equal(cosineSimilarity([1, 0, 0], [1, 0, 0]), 1);
});

test("cosineSimilarity is 0 for orthogonal vectors", () => {
  assert.ok(Math.abs(cosineSimilarity([1, 0], [0, 1])) < 1e-9);
});

test("parseEmbedding accepts JSON string", () => {
  assert.deepEqual(parseEmbedding("[1,2,3]"), [1, 2, 3]);
});

test("findSimilarCases falls back to candidates when RPC unavailable", async () => {
  const query = [1, 0, 0];
  const candidates = [
    { id: "a", topic: "A", summary: "", status: "published", embedding: [0.99, 0.1, 0] },
    { id: "b", topic: "B", summary: "", status: "published", embedding: [0, 1, 0] },
  ];
  const matches = await findSimilarCases(query, {
    candidates,
    threshold: 0.5,
    matchCount: 5,
  });
  assert.ok(matches.length >= 1);
  assert.equal(matches[0].id, "a");
  assert.ok(matches[0].similarity > 0.9);
});

test("duplicateFromMatches marks top hit above merge threshold", () => {
  const dup = duplicateFromMatches(
    [{ id: "x", topic: "T", summary: "S", status: "published", similarity: 0.9 }],
    []
  );
  assert.equal(dup.isDuplicate, true);
  assert.equal(dup.duplicateCaseId, "x");
});

test("classifyMatches suggests but does not auto-merge below threshold", async () => {
  const { classifyMatches } = await import("../backend/services/caseSimilarity.js");
  const result = classifyMatches(
    [{ id: "y", topic: "Y", summary: "S", status: "published", similarity: 0.55 }],
    []
  );
  assert.equal(result.isDuplicate, false);
  assert.equal(result.related.length, 1);
  assert.equal(result.matchSource, "embedding_suggest");
});
