#!/usr/bin/env node
/**
 * Local Auth setup for Main BleMap.
 *
 * 1) If SUPABASE_ACCESS_TOKEN is set (Dashboard → Account → Access Tokens):
 *    - mailer_autoconfirm = true  (Confirm email OFF)
 *    - site_url + redirect allowlist for localhost:4000
 * 2) Always (with SUPABASE_SERVICE_ROLE_KEY): confirm any existing unconfirmed users.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const PROJECT_REF =
  process.env.SUPABASE_PROJECT_REF ||
  (process.env.SUPABASE_URL || "").match(
    /https:\/\/([a-z0-9]+)\.supabase\.co/
  )?.[1];

const SITE_URL = "http://localhost:4000";
const REDIRECTS = [
  "http://localhost:4000",
  "http://localhost:4000/**",
  "http://localhost:4000/frontend/app.html",
];

async function configureViaManagementApi() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    console.log(
      "No SUPABASE_ACCESS_TOKEN — skip Management API.\n" +
        "  Create a token: https://supabase.com/dashboard/account/tokens\n" +
        "  Then: SUPABASE_ACCESS_TOKEN=sbp_… npm run configure:auth"
    );
    return false;
  }
  if (!PROJECT_REF) {
    console.error("Could not resolve project ref from SUPABASE_URL");
    return false;
  }

  const res = await fetch(
    `https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        site_url: SITE_URL,
        uri_allow_list: REDIRECTS.join(","),
        mailer_autoconfirm: true,
      }),
    }
  );

  const text = await res.text();
  if (!res.ok) {
    console.error("Management API auth config failed:", res.status, text);
    return false;
  }
  console.log("Auth config updated via Management API:");
  console.log("  mailer_autoconfirm: true (Confirm email OFF)");
  console.log(`  site_url: ${SITE_URL}`);
  console.log(`  redirects: ${REDIRECTS.join(", ")}`);
  return true;
}

async function confirmExistingUsers() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log("Skip user confirm: missing SUPABASE_URL or SERVICE_ROLE_KEY");
    return;
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let page = 1;
  let confirmed = 0;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    for (const user of data.users) {
      if (user.email_confirmed_at) continue;
      const { error: updErr } = await admin.auth.admin.updateUserById(user.id, {
        email_confirm: true,
      });
      if (updErr) throw updErr;
      confirmed += 1;
      console.log(`  confirmed ${user.email}`);
    }
    if (!data.users.length || data.users.length < 200) break;
    page += 1;
  }
  console.log(`Confirmed ${confirmed} previously unconfirmed user(s).`);
}

const viaApi = await configureViaManagementApi();
await confirmExistingUsers();

if (!viaApi) {
  console.log(
    "\nDashboard fallback (if Management API was skipped):\n" +
      `  https://supabase.com/dashboard/project/${PROJECT_REF || "_"}/auth/providers\n` +
      "  → Email → disable Confirm email\n" +
      `  https://supabase.com/dashboard/project/${PROJECT_REF || "_"}/auth/url-configuration\n` +
      `  → Site URL ${SITE_URL}; allow ${REDIRECTS.join(", ")}\n` +
      "\nLocal SPA still works: register calls POST /api/dev/confirm-email when NODE_ENV≠production."
  );
}
