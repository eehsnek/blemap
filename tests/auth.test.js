import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getUserId,
  requireAuth,
} from "../backend/middleware/auth.js";
import { requireAdmin } from "../backend/middleware/requireAdmin.js";
import { scrapePublishMode } from "../backend/ingestion/config.js";
import { resolvePublicSupabaseConfig } from "../shared/supabasePublic.js";

test("getUserId returns JWT user only and ignores body.user_id", () => {
  assert.equal(getUserId({ user: null, body: { user_id: "spoof" } }), null);
  assert.equal(
    getUserId({ user: undefined, body: { user_id: "spoof" }, query: { user_id: "q" } }),
    null
  );
  assert.equal(
    getUserId({ user: { id: "real-user" }, body: { user_id: "spoof" } }),
    "real-user"
  );
});

test("requireAuth returns 401 without verified user when BLEMAP_DEV_AUTH unset", async () => {
  const prevDev = process.env.BLEMAP_DEV_AUTH;
  const prevNode = process.env.NODE_ENV;
  delete process.env.BLEMAP_DEV_AUTH;
  process.env.NODE_ENV = "development";

  let status = null;
  let body = null;
  const req = { user: null, body: { user_id: "spoof" } };
  const res = {
    status(code) {
      status = code;
      return this;
    },
    json(payload) {
      body = payload;
      return this;
    },
  };
  let nextCalled = false;
  await requireAuth(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(status, 401);
  assert.equal(body?.error, "Authentication required");
  assert.equal(req.user, null);

  if (prevDev === undefined) delete process.env.BLEMAP_DEV_AUTH;
  else process.env.BLEMAP_DEV_AUTH = prevDev;
  if (prevNode === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = prevNode;
});

test("requireAuth allows verified user through", async () => {
  const req = { user: { id: "already-authed" } };
  let nextCalled = false;
  await requireAuth(req, { status() { return this; }, json() { return this; } }, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true);
  assert.equal(req.user.id, "already-authed");
});

test("requireAdmin rejects verified non-admin", async () => {
  const prev = process.env.BLEMAP_ADMIN_USER_IDS;
  delete process.env.BLEMAP_ADMIN_USER_IDS;
  let status = null;
  let body = null;
  await requireAdmin(
    { user: { id: "community-1" } },
    {
      status(code) {
        status = code;
        return this;
      },
      json(payload) {
        body = payload;
        return this;
      },
    },
    () => {}
  );
  assert.equal(status, 403);
  assert.equal(body?.error, "Admin role required");
  if (prev === undefined) delete process.env.BLEMAP_ADMIN_USER_IDS;
  else process.env.BLEMAP_ADMIN_USER_IDS = prev;
});

test("requireAdmin allows allowlisted steward", async () => {
  const prev = process.env.BLEMAP_ADMIN_USER_IDS;
  process.env.BLEMAP_ADMIN_USER_IDS = "steward-1";
  let nextCalled = false;
  await requireAdmin(
    { user: { id: "steward-1" } },
    { status() { return this; }, json() { return this; } },
    () => {
      nextCalled = true;
    }
  );
  assert.equal(nextCalled, true);
  if (prev === undefined) delete process.env.BLEMAP_ADMIN_USER_IDS;
  else process.env.BLEMAP_ADMIN_USER_IDS = prev;
});

test("scrapePublishMode defaults to pending", () => {
  const prev = process.env.SCRAPE_PUBLISH_MODE;
  delete process.env.SCRAPE_PUBLISH_MODE;
  assert.equal(scrapePublishMode(), "pending");
  process.env.SCRAPE_PUBLISH_MODE = "auto";
  assert.equal(scrapePublishMode(), "auto");
  process.env.SCRAPE_PUBLISH_MODE = "pending";
  assert.equal(scrapePublishMode(), "pending");
  if (prev === undefined) delete process.env.SCRAPE_PUBLISH_MODE;
  else process.env.SCRAPE_PUBLISH_MODE = prev;
});

test("resolvePublicSupabaseConfig has no hardcoded fallback", () => {
  const empty = resolvePublicSupabaseConfig({});
  assert.equal(empty.configured, false);
  assert.equal(empty.url, null);
  assert.equal(empty.anonKey, null);

  const placeholder = resolvePublicSupabaseConfig({
    SUPABASE_URL: "https://your-project.supabase.co",
    SUPABASE_ANON_KEY: "your-anon-key",
  });
  assert.equal(placeholder.configured, false);

  const live = resolvePublicSupabaseConfig({
    SUPABASE_URL: "https://abcd1234.supabase.co",
    SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test",
  });
  assert.equal(live.configured, true);
  assert.equal(live.url, "https://abcd1234.supabase.co");
});
