import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeSubmitText } from "../backend/lib/normalizeSubmitText.js";

test("fixes philippines and among typos", () => {
  const out = normalizeSubmitText("unemployment in philiphines amoung youths");
  assert.match(out, /Philippines/);
  assert.match(out, /among/);
  assert.doesNotMatch(out, /philiphines/i);
});
