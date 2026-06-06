import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeSolve } from "../backend/ai/analyzeSolve.js";

const caseRow = {
  topic: "Housing deposit dispute",
  summary: "Landlord withholding deposit after move-out without itemized damages.",
  domain: "law",
};

test("rejects too-short solve", async () => {
  const r = await analyzeSolve("Call a lawyer.", caseRow);
  assert.equal(r.isRelevant, false);
  assert.ok(r.rejectionMessage);
});

test("accepts relevant heuristic solve", async () => {
  const text =
    "Document all move-out photos and send a formal demand letter to the landlord citing local tenant deposit laws. Request itemized deductions within the statutory deadline and file with small claims court if they refuse.";
  const r = await analyzeSolve(text, caseRow);
  assert.equal(r.isRelevant, true);
  assert.ok(r.qualityScore > 0.4);
});
