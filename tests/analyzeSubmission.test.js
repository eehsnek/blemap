import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeSubmission } from "../backend/ai/analyzeSubmission.js";

test("rejects very short input", async () => {
  const r = await analyzeSubmission("too short", []);
  assert.equal(r.isValid, false);
  assert.ok(r.rejectionMessage);
});

test("accepts substantive problem", async () => {
  const r = await analyzeSubmission(
    "My landlord has refused to return my security deposit for three months despite no damages listed on move-out inspection report.",
    []
  );
  assert.equal(r.isValid, true);
  assert.ok(r.structured.topic);
  assert.equal(r.structured.domain, "law");
});
