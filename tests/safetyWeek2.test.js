import { test } from "node:test";
import assert from "node:assert/strict";
import { createMemoryStore } from "../backend/store/memoryStore.js";
import { requireCronOrUser } from "../backend/middleware/cronAuth.js";
import { geminiModelId, buildHealthReport } from "../backend/lib/healthChecks.js";

test("second claim on same case returns 409", async () => {
  const store = createMemoryStore();
  const matrix = await store.listMatrixCases();
  const c = matrix.find((x) => !x.claimed_by);
  assert.ok(c);

  const first = await store.toggleClaim(c.id, "user-a");
  assert.equal(first.state, "claimed");

  const second = await store.toggleClaim(c.id, "user-b");
  assert.equal(second.status, 409);
  assert.match(second.error, /claimed/i);

  const again = await store.getCase(c.id);
  assert.equal(again.claimed_by, "user-a");
});

test("admin hide archives and restore recovers", async () => {
  const store = createMemoryStore();
  const matrix = await store.listMatrixCases();
  const c = matrix[0];
  const hidden = await store.adminHide(c.id, "admin-1");
  assert.equal(hidden.case.status, "archived");

  const matrixAfter = await store.listMatrixCases();
  assert.ok(!matrixAfter.some((x) => x.id === c.id));

  const restored = await store.adminRestore(c.id, "admin-1");
  assert.ok(["published", "pending"].includes(restored.case.status));
});

test("admin publish forces published", async () => {
  const store = createMemoryStore();
  const { draftId } = await store.analyzeSubmit({
    text: "Unique alpaca shipping delays harm small shops waiting weeks for inventory restock.",
    userId: "u1",
  });
  const { case: pending } = await store.confirmSubmit({ draftId, userId: "u1" });
  assert.equal(pending.status, "pending");

  const published = await store.adminPublish(pending.id, "admin-1");
  assert.equal(published.case.status, "published");
});

test("requireCronOrUser rejects anonymous without secret", () => {
  const prev = process.env.CRON_SECRET;
  delete process.env.CRON_SECRET;

  let status = null;
  const req = { user: null, headers: {} };
  const res = {
    status(code) {
      status = code;
      return this;
    },
    json() {
      return this;
    },
  };
  let next = false;
  requireCronOrUser(req, res, () => {
    next = true;
  });
  assert.equal(next, false);
  assert.equal(status, 401);

  if (prev === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = prev;
});

test("requireCronOrUser allows signed-in user", () => {
  let next = false;
  requireCronOrUser(
    { user: { id: "u1" }, headers: {} },
    { status() { return this; }, json() { return this; } },
    () => {
      next = true;
    }
  );
  assert.equal(next, true);
});

test("buildHealthReport includes store supabase gemini", async () => {
  const report = await buildHealthReport({ deep: false });
  assert.ok(report.store);
  assert.equal(typeof report.supabase.configured, "boolean");
  assert.ok(report.gemini.model);
  assert.equal(report.gemini.model, geminiModelId());
});
