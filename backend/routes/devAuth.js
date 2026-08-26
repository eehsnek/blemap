import { Router } from "express";
import { getSupabaseAdmin } from "../lib/supabaseAdmin.js";
import {
  demoStewardEnabled,
  ensureDemoStewardAccount,
} from "../lib/demoSteward.js";

const router = Router();

function rejectIfProduction(req, res) {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL === "1") {
    res.status(404).json({ error: "Not found" });
    return true;
  }
  return false;
}

/**
 * Local-only: confirm a just-registered email so Sign In works without
 * Dashboard "Confirm email" off (or after Management API autoconfirm).
 */
router.post("/confirm-email", async (req, res, next) => {
  try {
    if (rejectIfProduction(req, res)) return;

    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();
    if (!email) return res.status(400).json({ error: "email required" });

    const admin = getSupabaseAdmin();
    if (!admin) {
      return res.status(503).json({
        error: "SUPABASE_SERVICE_ROLE_KEY required for local email confirm",
      });
    }

    const perPage = 200;
    let page = 1;
    let user = null;
    for (;;) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      user = data.users.find((u) => u.email?.toLowerCase() === email) || null;
      if (user || !data.users.length || data.users.length < perPage) break;
      page += 1;
    }

    if (!user) return res.status(404).json({ error: "User not found" });

    if (!user.email_confirmed_at) {
      const { error } = await admin.auth.admin.updateUserById(user.id, {
        email_confirm: true,
      });
      if (error) throw error;
    }

    res.json({ ok: true, email, confirmed: true });
  } catch (err) {
    next(err);
  }
});

/**
 * Local/demo: provision steward.demo@blemap.local as admin and return credentials
 * for one-click Steward desk sign-in.
 */
router.post("/demo-steward", async (req, res, next) => {
  try {
    if (rejectIfProduction(req, res)) return;
    if (!demoStewardEnabled()) {
      return res.status(404).json({ error: "Not found" });
    }

    const result = await ensureDemoStewardAccount();
    if (result.error) {
      return res.status(result.status ?? 500).json({ error: result.error });
    }

    res.json({
      ok: true,
      email: result.email,
      password: result.password,
      userId: result.userId,
      message: result.message,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/demo-steward", async (req, res) => {
  if (rejectIfProduction(req, res)) return;
  res.json({
    enabled: demoStewardEnabled(),
    email: demoStewardEnabled()
      ? process.env.BLEMAP_DEMO_STEWARD_EMAIL || "steward.demo@blemap.local"
      : null,
  });
});

export default router;
