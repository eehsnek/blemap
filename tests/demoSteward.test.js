import { test } from "node:test";
import assert from "node:assert/strict";
import {
  demoStewardCredentials,
  demoStewardEnabled,
} from "../backend/lib/demoSteward.js";

test("demoStewardEnabled is off in production", () => {
  assert.equal(demoStewardEnabled({ NODE_ENV: "production" }), false);
  assert.equal(demoStewardEnabled({ VERCEL: "1" }), false);
  assert.equal(demoStewardEnabled({ BLEMAP_DEMO_STEWARD: "0" }), false);
  assert.equal(demoStewardEnabled({ NODE_ENV: "development" }), true);
});

test("demoStewardCredentials defaults", () => {
  const c = demoStewardCredentials({});
  assert.equal(c.email, "steward.demo@blemap.local");
  assert.ok(c.password.length >= 12);
});
