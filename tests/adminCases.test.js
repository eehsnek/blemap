import { test } from "node:test";
import assert from "node:assert/strict";
import {
  casePriority,
  filterCases,
  sortCases,
  searchCases,
  summarizeCases,
  pickAdminEdits,
  normalizeAdminReason,
} from "../backend/lib/adminCases.js";
import { createMemoryStore } from "../backend/store/memoryStore.js";

const FIXTURE = [
  {
    id: "1",
    status: "pending",
    source: "hackernews",
    domain: "tech",
    topic: "Slow CI",
    summary: "Builds take forever",
    claimed_by: null,
  },
  {
    id: "2",
    status: "pending",
    source: "user",
    domain: "law",
    topic: "Deposit dispute",
    summary: "Landlord withheld deposit",
    claimed_by: null,
  },
  {
    id: "3",
    status: "published",
    source: "user",
    domain: "general",
    topic: "Noise complaint",
    summary: "Neighbors",
    claimed_by: "u1",
  },
  {
    id: "4",
    status: "archived",
    source: "reddit",
    domain: "medicine",
    topic: "Spam",
    summary: "junk",
    claimed_by: null,
  },
];

test("summarizeCases counts steward pulse buckets", () => {
  const s = summarizeCases(FIXTURE);
  assert.equal(s.total, 4);
  assert.equal(s.pending, 2);
  assert.equal(s.published, 1);
  assert.equal(s.archived, 1);
  assert.equal(s.claimed, 1);
  assert.equal(s.scrapePending, 1);
  assert.equal(s.sensitive, 2);
});

test("filterCases supports steward tabs", () => {
  assert.equal(filterCases(FIXTURE, "pending").length, 2);
  assert.equal(filterCases(FIXTURE, "scrape")[0].id, "1");
  assert.equal(filterCases(FIXTURE, "sensitive").length, 2);
  assert.equal(filterCases(FIXTURE, "claimed")[0].id, "3");
  assert.equal(filterCases(FIXTURE, "hidden")[0].id, "4");
  assert.equal(filterCases(FIXTURE, "flagged").length, 0);
  assert.equal(filterCases(FIXTURE, "all").length, 4);
});

test("searchCases matches topic and domain", () => {
  assert.equal(searchCases(FIXTURE, "deposit").length, 1);
  assert.equal(searchCases(FIXTURE, "law")[0].id, "2");
  assert.equal(searchCases(FIXTURE, "").length, 4);
});

test("casePriority and sortCases surface urgent moderation work first", () => {
  const rows = [
    {
      id: "published-claimed",
      status: "published",
      claimed_by: "u1",
      domain: "general",
      source: "user",
      created_at: "2026-08-21T00:00:00.000Z",
      gap_score: 10,
    },
    {
      id: "pending-user",
      status: "pending",
      claimed_by: null,
      domain: "general",
      source: "user",
      created_at: "2026-08-20T00:00:00.000Z",
      gap_score: 20,
    },
    {
      id: "flagged",
      status: "published",
      flagged: true,
      claimed_by: null,
      domain: "general",
      source: "user",
      created_at: "2026-08-19T00:00:00.000Z",
      gap_score: 5,
    },
  ];
  assert.equal(casePriority(rows[2]).label, "Flagged");
  assert.deepEqual(sortCases(rows, "priority").map((c) => c.id), [
    "flagged",
    "pending-user",
    "published-claimed",
  ]);
  assert.equal(sortCases(rows, "newest")[0].id, "published-claimed");
});

test("pickAdminEdits and reason helpers", () => {
  const ok = pickAdminEdits({ topic: "Fixed title", domain: "Law" });
  assert.deepEqual(ok.patch, { topic: "Fixed title", domain: "law" });
  assert.equal(pickAdminEdits({ topic: "  " }).error, "topic cannot be empty");
  assert.equal(normalizeAdminReason("  hello   world  "), "hello world");
});

test("adminPatch merge unaccept and reason metadata", async () => {
  const store = createMemoryStore();
  const list = await store.adminListModeration();
  const a = list[0];
  const b = list[1];
  assert.ok(a && b);

  const patched = await store.adminPatch(
    a.id,
    "admin-1",
    { topic: "Repaired topic", summary: "Clearer summary" },
    "help validators"
  );
  assert.equal(patched.case.topic, "Repaired topic");

  const published = await store.adminPublish(a.id, "admin-1", "demo unblock");
  assert.equal(published.case.status, "published");
  const events = await store.getCaseEvents(a.id);
  assert.ok(events.some((e) => e.metadata?.reason === "demo unblock"));

  const flagged = await store.adminFlag(a.id, "admin-1", "needs review");
  assert.equal(flagged.case.flagged, true);
  const matrix = await store.listMatrixCases();
  assert.ok(!matrix.some((c) => c.id === a.id));
  await store.adminUnflag(a.id, "admin-1");

  const merged = await store.adminMerge(b.id, a.id, "admin-1", "duplicate noise");
  assert.equal(merged.case.id, a.id);
  assert.equal(merged.archived.status, "archived");
  assert.ok(merged.case.pain_count >= a.pain_count);

  await store.toggleClaim(a.id, "claimer-1");
  const solve = await store.addSolve(
    a.id,
    "claimer-1",
    "Here is a concrete remediation path that addresses the reported problem with clear steps."
  );
  assert.ok(!solve.error, solve.error);
  await store.acceptSolve(solve.solve.id, "claimer-1");
  const reopened = await store.adminUnacceptSolve(
    solve.solve.id,
    "admin-1",
    "bad solution"
  );
  assert.equal(reopened.solve.accepted, false);
  assert.notEqual(reopened.case.lifecycle_state, "green");
});
