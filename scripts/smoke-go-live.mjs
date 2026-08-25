#!/usr/bin/env node
/**
 * Go-live smoke: ensure store=supabase, create confirmed user, scrape HN, assert published cases.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:4000";
const email =
  process.env.SMOKE_EMAIL ||
  `blemap.smoke.${Date.now()}@gmail.com`;
const password = process.env.SMOKE_PASSWORD || "SmokeTest123!";

async function main() {
  const health = await fetch(`${BASE}/health`).then((r) => r.json());
  if (!health.ok) throw new Error(`health failed: ${JSON.stringify(health)}`);
  if (health.store !== "supabase") {
    throw new Error(`expected store:supabase, got ${health.store}`);
  }
  console.log("health ok:", health);

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL + SERVICE_ROLE_KEY required");

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr) throw createErr;
  console.log("user created:", created.user.email);

  const { data: sessionData, error: signErr } = await admin.auth.signInWithPassword({
    email,
    password,
  });
  if (signErr) throw signErr;
  const token = sessionData.session.access_token;

  const scrapeRes = await fetch(`${BASE}/api/scrape/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const scrapeBody = await scrapeRes.json();
  if (!scrapeRes.ok) {
    throw new Error(`scrape failed ${scrapeRes.status}: ${JSON.stringify(scrapeBody)}`);
  }
  console.log("scrape:", {
    ok: scrapeBody.ok,
    published: scrapeBody.published ?? scrapeBody.casesPublished,
    status: scrapeBody.status,
  });

  const casesRes = await fetch(`${BASE}/api/cases?status=published`);
  const cases = await casesRes.json();
  if (!casesRes.ok) throw new Error(`cases failed: ${JSON.stringify(cases)}`);
  const list = Array.isArray(cases) ? cases : cases.cases || [];
  console.log(`published cases: ${list.length}`);
  if (!list.length) {
    throw new Error("expected at least one published case after scrape");
  }
  console.log("smoke OK — Matrix should show cases at", `${BASE}/frontend/app.html#/matrix`);
}

main().catch((err) => {
  console.error("smoke FAILED:", err.message || err);
  process.exit(1);
});
