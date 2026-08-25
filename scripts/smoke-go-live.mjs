#!/usr/bin/env node
/**
 * Go-live / E2E smoke for Main BleMap.
 *
 * Path A (default): anon signUp → /api/dev/confirm-email → signIn
 *   → submit analyze → confirm → assert pending case
 * Path B: also run scrape and assert published cases exist
 *
 * Env:
 *   SMOKE_BASE_URL, SMOKE_EMAIL, SMOKE_PASSWORD
 *   SMOKE_SKIP_SCRAPE=1 to skip HN scrape
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:4000";
const email =
  process.env.SMOKE_EMAIL || `blemap.e2e.${Date.now()}@gmail.com`;
const password = process.env.SMOKE_PASSWORD || "SmokeTest123!";
const skipScrape = process.env.SMOKE_SKIP_SCRAPE === "1";

const PROBLEM_TEXT = `
My landlord in Manila refuses to return my security deposit after I moved out.
I left the unit clean, took photos, and followed the lease. He keeps saying
he'll "process it next week" for three months. I need a clear next step.
`.trim();

async function json(res) {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${res.status} ${JSON.stringify(body)}`);
  }
  return body;
}

async function main() {
  const health = await json(await fetch(`${BASE}/health`));
  if (health.store !== "supabase") {
    throw new Error(`expected store:supabase, got ${health.store}`);
  }
  console.log("1) health ok:", health);

  const url = process.env.SUPABASE_URL;
  const anon = process.env.SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service) {
    throw new Error("SUPABASE_URL, ANON_KEY, and SERVICE_ROLE_KEY required");
  }

  // Mirror SPA: browser anon client + local confirm helper
  const browser = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: signedUp, error: signUpErr } = await browser.auth.signUp({
    email,
    password,
  });
  if (signUpErr) throw signUpErr;
  console.log("2) signUp:", email, signedUp.session ? "(session)" : "(needs confirm)");

  if (!signedUp.session) {
    const confirm = await json(
      await fetch(`${BASE}/api/dev/confirm-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
    );
    console.log("3) confirm-email:", confirm);
    const { data: signedIn, error: signInErr } =
      await browser.auth.signInWithPassword({ email, password });
    if (signInErr) throw signInErr;
    if (!signedIn.session) throw new Error("signIn returned no session");
    Object.assign(signedUp, signedIn);
  } else {
    console.log("3) confirm-email: skipped (already session)");
  }

  const token = signedUp.session.access_token;
  const auth = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  const analyzed = await json(
    await fetch(`${BASE}/api/submit/analyze`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ text: PROBLEM_TEXT }),
    })
  );
  if (!analyzed.draftId) {
    throw new Error(`analyze missing draftId: ${JSON.stringify(analyzed)}`);
  }
  console.log(
    "4) analyze draftId:",
    analyzed.draftId,
    "title:",
    analyzed.draft?.title || analyzed.preview?.title || analyzed.title || "(none)"
  );

  const confirmed = await json(
    await fetch(`${BASE}/api/submit/confirm`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({ draftId: analyzed.draftId }),
    })
  );
  const caseId = confirmed.case?.id || confirmed.id;
  if (!caseId) throw new Error(`confirm missing case: ${JSON.stringify(confirmed)}`);
  console.log("5) submit confirm case:", caseId, "status:", confirmed.case?.status || confirmed.status);

  const one = await json(await fetch(`${BASE}/api/cases/${caseId}`, { headers: auth }));
  console.log("6) get case:", one.id || one.case?.id, "status:", one.status || one.case?.status);

  // Community validate (same user can only confirm once — create helpers)
  const admin = createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const need = Number(process.env.CONFIRMATIONS_REQUIRED || 5);
  let status = one.status || one.case?.status;
  for (let i = 0; i < need && status !== "published"; i += 1) {
    const helperEmail = `blemap.val.${Date.now()}.${i}@gmail.com`;
    const { data: helper, error: hErr } = await admin.auth.admin.createUser({
      email: helperEmail,
      password,
      email_confirm: true,
    });
    if (hErr) throw hErr;
    const { data: hSession, error: hsErr } = await admin.auth.signInWithPassword({
      email: helperEmail,
      password,
    });
    if (hsErr) throw hsErr;
    const vRes = await fetch(`${BASE}/api/cases/${caseId}/confirm`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${hSession.session.access_token}`,
        "Content-Type": "application/json",
      },
    });
    const vBody = await vRes.json();
    if (!vRes.ok) throw new Error(`validate failed: ${JSON.stringify(vBody)}`);
    status = vBody.case?.status || vBody.status || status;
    console.log(`7) validate ${i + 1}/${need} →`, status);
  }

  if (status !== "published") {
    throw new Error(`expected published after ${need} validates, got ${status}`);
  }

  if (!skipScrape) {
    const scrapeRes = await fetch(`${BASE}/api/scrape/run`, {
      method: "POST",
      headers: auth,
    });
    const scrapeBody = await scrapeRes.json();
    if (!scrapeRes.ok) {
      console.warn("8) scrape warn:", scrapeRes.status, scrapeBody);
    } else {
      console.log("8) scrape ok");
    }
  } else {
    console.log("8) scrape skipped");
  }

  const cases = await json(await fetch(`${BASE}/api/cases?status=published`));
  const list = Array.isArray(cases) ? cases : cases.cases || [];
  console.log(`9) published cases: ${list.length}`);
  if (!list.length) throw new Error("no published cases");

  console.log("\nE2E OK");
  console.log(`  App:    ${BASE}/frontend/app.html`);
  console.log(`  Matrix: ${BASE}/frontend/app.html#/matrix`);
  console.log(`  Login:  ${email} / ${password}`);
}

main().catch((err) => {
  console.error("E2E FAILED:", err.message || err);
  process.exit(1);
});
