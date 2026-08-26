import { getSupabaseAdmin } from "./supabaseAdmin.js";

export const DEMO_STEWARD_EMAIL_DEFAULT = "steward.demo@blemap.local";
export const DEMO_STEWARD_PASSWORD_DEFAULT = "BleMap-Steward-Demo-2026!";

export function demoStewardEnabled(env = process.env) {
  if (env.NODE_ENV === "production" || env.VERCEL === "1") return false;
  if (env.BLEMAP_DEMO_STEWARD === "0") return false;
  return true;
}

export function demoStewardCredentials(env = process.env) {
  return {
    email: (env.BLEMAP_DEMO_STEWARD_EMAIL || DEMO_STEWARD_EMAIL_DEFAULT)
      .trim()
      .toLowerCase(),
    password:
      env.BLEMAP_DEMO_STEWARD_PASSWORD?.trim() || DEMO_STEWARD_PASSWORD_DEFAULT,
  };
}

async function findUserByEmail(admin, email) {
  const perPage = 200;
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLowerCase() === email) || null;
    if (user || !data.users.length || data.users.length < perPage) return user;
    page += 1;
  }
}

async function ensureAdminRole(admin, userId, username) {
  const { data: role, error: roleErr } = await admin
    .from("roles")
    .select("id")
    .eq("name", "admin")
    .maybeSingle();
  if (roleErr) throw roleErr;
  if (!role?.id) {
    throw new Error(
      "Admin role missing. Run database/migrations/009_admin_role.sql first."
    );
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    const { error: insertErr } = await admin.from("profiles").insert({
      id: userId,
      username: username || "steward-demo",
      role_id: role.id,
    });
    if (insertErr) throw insertErr;
    return;
  }

  const { error: updateErr } = await admin
    .from("profiles")
    .update({ role_id: role.id })
    .eq("id", userId);
  if (updateErr) throw updateErr;
}

/**
 * Ensure a local demo steward auth user + admin profile exist.
 * Non-production only.
 */
export async function ensureDemoStewardAccount(env = process.env) {
  if (!demoStewardEnabled(env)) {
    return { error: "Demo steward login is disabled", status: 404 };
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return {
      error:
        "SUPABASE_SERVICE_ROLE_KEY required to provision the demo steward account",
      status: 503,
    };
  }

  const { email, password } = demoStewardCredentials(env);
  let user = await findUserByEmail(admin, email);

  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username: "steward-demo", demo: true },
    });
    if (error) throw error;
    user = data.user;
  } else {
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
      user_metadata: { ...(user.user_metadata || {}), demo: true },
    });
    if (error) throw error;
  }

  await ensureAdminRole(
    admin,
    user.id,
    user.user_metadata?.username || email.split("@")[0]
  );

  return {
    email,
    password,
    userId: user.id,
    message: "Demo steward ready",
  };
}
