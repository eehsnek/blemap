import { createClient } from "@supabase/supabase-js";
import { isProfileDisabled } from "../lib/adminUsers.js";

let supabaseAuth;

function getAuthClient() {
  if (!supabaseAuth) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    supabaseAuth = createClient(url, key);
  }
  return supabaseAuth;
}

function allowDevAuthBypass() {
  return (
    process.env.BLEMAP_DEV_AUTH === "1" &&
    process.env.NODE_ENV !== "production" &&
    !getAuthClient()
  );
}

export async function optionalAuth(req, _res, next) {
  req.user = null;
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next();

  const token = header.slice(7);
  const client = getAuthClient();
  if (!client) {
    return next();
  }

  const { data, error } = await client.auth.getUser(token);
  if (!error && data?.user) req.user = data.user;
  next();
}

export async function requireAuth(req, res, next) {
  try {
    if (!req.user?.id) {
      if (allowDevAuthBypass()) {
        req.user = { id: "dev-local-user" };
        return next();
      }
      return res.status(401).json({ error: "Authentication required" });
    }
    if (await isProfileDisabled(req.user.id)) {
      return res
        .status(403)
        .json({ error: "Account disabled by Archive Steward" });
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

/** Verified JWT identity only — never trust body or query user_id (SR-01). */
export function getUserId(req) {
  return req.user?.id ?? null;
}
