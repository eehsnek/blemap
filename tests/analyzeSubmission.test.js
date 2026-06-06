import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeSubmission } from "../backend/ai/analyzeSubmission.js";

test("rejects very short input", async () => {
  const r = await analyzeSubmission("too short", []);
  assert.equal(r.isValid, false);
  assert.ok(r.rejectionMessage);
  assert.ok(Array.isArray(r.suggestions));
  assert.ok(r.suggestions.length >= 1);
});

test("short unemployment topic returns coach suggestions", async () => {
  const r = await analyzeSubmission("unemployment in philiphines amoung youths", []);
  assert.equal(r.isValid, false);
  assert.equal(r.rejectionReason, "too_short_topic");
  assert.ok(r.expandPrompt.toLowerCase().includes("employment"));
  assert.ok(r.suggestions.some((s) => /scale|cause|location/i.test(s)));
});

test("normalizes common typos before analyze", async () => {
  const r = await analyzeSubmission(
    "Young graduates in the Philippines among youths cannot find entry level jobs because companies want experience.",
    []
  );
  assert.equal(r.isValid, true);
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
