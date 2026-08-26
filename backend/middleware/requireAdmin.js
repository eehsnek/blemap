import { createClient } from "@supabase/supabase-js";

let adminClient;

function getServiceClient() {
  if (adminClient) return adminClient;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  adminClient = createClient(url, key);
  return adminClient;
}

function adminAllowlist() {
  return (process.env.BLEMAP_ADMIN_USER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Resolve whether a user id is an admin.
 * Prefer profiles.roles.name = 'admin'. Fallback: BLEMAP_ADMIN_USER_IDS allowlist
 * (for memory-store / bootstrap). Stewards can promote others via /api/admin/users.
 */
export async function isAdminUser(userId) {
  if (!userId) return false;
  if (adminAllowlist().includes(userId)) return true;

  const client = getServiceClient();
  if (!client) return false;

  const { data, error } = await client
    .from("profiles")
    .select("role_id, roles(name)")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) return false;
  const roleName = data.roles?.name;
  return roleName === "admin";
}

export async function requireAdmin(req, res, next) {
  if (!req.user?.id) {
    return res.status(401).json({ error: "Authentication required" });
  }
  try {
    const ok = await isAdminUser(req.user.id);
    if (!ok) {
      return res.status(403).json({ error: "Admin role required" });
    }
    req.isAdmin = true;
    return next();
  } catch (err) {
    return next(err);
  }
}
