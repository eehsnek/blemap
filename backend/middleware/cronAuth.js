/**
 * Cron: Authorization Bearer CRON_SECRET (Vercel sends this when CRON_SECRET env is set).
 * Manual: logged-in user JWT, or open in non-production when CRON_SECRET unset.
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

  if (!secret && process.env.NODE_ENV !== "production") {
    return next();
  }

  return res.status(401).json({
    error:
      "Unauthorized. Use CRON_SECRET (Bearer or x-cron-secret) or sign in.",
  });
}
