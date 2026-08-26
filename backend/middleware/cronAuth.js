/**
 * Cron: Authorization Bearer CRON_SECRET (Vercel sends this when CRON_SECRET env is set).
 * Manual: logged-in user JWT.
 * Never open (even in dev) — set CRON_SECRET or sign in (SR-15).
 */
export function requireCronOrUser(req, res, next) {
  const secret = process.env.CRON_SECRET?.trim();
  const authHeader = req.headers.authorization ?? "";
  const cronHeader = req.headers["x-cron-secret"];
  const bearer =
    authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (secret && (bearer === secret || cronHeader === secret)) {
    return next();
  }

  if (req.user?.id) {
    return next();
  }

  return res.status(401).json({
    error:
      "Unauthorized. Use CRON_SECRET (Bearer or x-cron-secret) or sign in.",
  });
}

export function isProdLikeEnv(env = process.env) {
  return env.NODE_ENV === "production" || env.VERCEL === "1";
}
