import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  LOGIN_POLICY,
  applyLoginFailure,
  applyLoginSuccess,
  inspectLock,
  normalizeEmail,
  isValidEmail,
  validateNewPassword,
  lockoutMessage,
  GENERIC_FORGOT_OK,
  GENERIC_LOGIN_ERROR,
  resetAuthSafetyMemory,
  recordLoginFailure,
  recordLoginSuccess,
  checkLoginAllowed,
  requestPasswordReset,
  isDevAuthExtras,
} from "../backend/lib/authSafety.js";

test("normalizeEmail trims and lowercases", () => {
  assert.equal(normalizeEmail("  Admin@BleMap.DEV "), "admin@blemap.dev");
});

test("isValidEmail rejects junk", () => {
  assert.equal(isValidEmail("not-an-email"), false);
  assert.equal(isValidEmail("a@b.c"), true);
  assert.equal(isValidEmail(""), false);
});

test("validateNewPassword enforces length letter and number", () => {
  assert.match(validateNewPassword("short").error, /8 characters/);
  assert.match(validateNewPassword("allletters").error, /letter and a number/);
  assert.match(validateNewPassword("12345678").error, /letter and a number/);
  assert.match(validateNewPassword("Abcdefg1", "other").error, /do not match/);
  assert.equal(validateNewPassword("Abcdefg1", "Abcdefg1").ok, true);
});

test("lockout trips after max failed attempts in the window", () => {
  const now = 1_000_000;
  let rec = null;
  let last;
  for (let i = 0; i < LOGIN_POLICY.maxFails; i += 1) {
    last = applyLoginFailure(rec, now + i * 1000);
    rec = last.record;
  }
  assert.equal(last.locked, true);
  assert.equal(last.remainingAttempts, 0);
  assert.ok(last.remaining >= LOGIN_POLICY.lockMs - 1);

  const check = inspectLock(rec, now);
  assert.equal(check.locked, true);
  assert.match(lockoutMessage(check.remaining), /Too many sign-in attempts/);
});

test("lockout window resets after idle period", () => {
  const now = 1_000_000;
  let rec = applyLoginFailure(null, now).record;
  rec = applyLoginFailure(rec, now + 1000).record;
  const later = applyLoginFailure(rec, now + LOGIN_POLICY.windowMs + 5);
  assert.equal(later.locked, false);
  assert.equal(later.record.failCount, 1);
});

test("successful login clears the failure window", () => {
  const now = 2_000_000;
  let rec = applyLoginFailure(null, now).record;
  rec = applyLoginFailure(rec, now + 1).record;
  const cleared = applyLoginSuccess(now + 2);
  const check = inspectLock(cleared, now + 2);
  assert.equal(check.locked, false);
  assert.equal(check.remainingAttempts, LOGIN_POLICY.maxFails);
});

describe("auth lockout store", { concurrency: false }, () => {
  test("recordLoginFailure then checkLoginAllowed uses memory store", async () => {
    resetAuthSafetyMemory();
    const email = "lockout-user@example.com";
    const ip = "127.0.0.1";
    for (let i = 0; i < LOGIN_POLICY.maxFails; i += 1) {
      await recordLoginFailure(email, ip);
    }
    const gate = await checkLoginAllowed(email, ip);
    assert.equal(gate.locked, true);
    assert.equal(gate.code, "locked");
    await recordLoginSuccess(email);
    const after = await checkLoginAllowed(email, ip);
    assert.equal(after.locked, false);
  });

  test("forgot-password is generic and does not require a real user", async () => {
    resetAuthSafetyMemory();
    const missing = await requestPasswordReset(
      "nobody-exists-xyz@example.com",
      "127.0.0.1",
      { headers: { origin: "http://localhost:4000" } }
    );
    assert.equal(missing.status, 200);
    assert.equal(missing.body.ok, true);
    assert.equal(missing.body.message, GENERIC_FORGOT_OK);
  });

  test("forgot-password rate-limits repeated requests", async () => {
    resetAuthSafetyMemory();
    const email = "repeat-reset@example.com";
    const ip = "10.0.0.9";
    const req = { headers: { origin: "http://localhost:4000" } };
    for (let i = 0; i < 3; i += 1) {
      const r = await requestPasswordReset(email, ip, req);
      assert.equal(r.status, 200);
    }
    const blocked = await requestPasswordReset(email, ip, req);
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.code, "locked");
  });
});

test("isDevAuthExtras is off in production", () => {
  assert.equal(isDevAuthExtras({ NODE_ENV: "production" }), false);
  assert.equal(isDevAuthExtras({ VERCEL: "1" }), false);
  assert.equal(isDevAuthExtras({ NODE_ENV: "development" }), true);
});

test("generic login error copy does not reveal whether the email exists", () => {
  assert.equal(GENERIC_LOGIN_ERROR.includes("not found"), false);
  assert.equal(GENERIC_LOGIN_ERROR.toLowerCase().includes("no user"), false);
});
