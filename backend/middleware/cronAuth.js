import { isAdminUser } from "./requireAdmin.js";

/**
 * Cron: Authorization Bearer CRON_SECRET (Vercel sends this when CRON_SECRET env is set).
 * Manual: Archive Steward JWT only — not every signed-in community user (fault tree 3).
 */
export async function requireCronOrAdmin(req, res, next) {
  const secret = process.env.CRON_SECRET?.trim();
  const authHeader = req.headers.authorization ?? "";
  const cronHeader = req.headers["x-cron-secret"];
  const bearer =
    authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (secret && (bearer === secret || cronHeader === secret)) {
    return next();
  }

  if (!req.user?.id) {
    return res.status(401).json({
      error:
        "Unauthorized. Use CRON_SECRET (Bearer or x-cron-secret) or sign in as Archive Steward.",
    });
  }

  try {
    if (await isAdminUser(req.user.id)) {
      return next();
    }
  } catch (err) {
    return next(err);
  }

  return res.status(403).json({
    error: "Archive Steward role or CRON_SECRET required to run scrape.",
  });
}

/** @deprecated use requireCronOrAdmin — kept for tests that assert anonymous reject */
export function requireCronOrUser(req, res, next) {
  return requireCronOrAdmin(req, res, next);
}

export function isProdLikeEnv(env = process.env) {
  return env.NODE_ENV === "production" || env.VERCEL === "1";
}
