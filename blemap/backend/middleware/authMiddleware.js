import { createClient } from "@supabase/supabase-js";

const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

export async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    console.log(
      "BACKEND AUTH HEADER:",
      authHeader
        ? `${authHeader.substring(0, 20)}...`
        : authHeader
    );

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Missing authentication token"
      });
    }

    const token = authHeader.replace("Bearer ", "");

    const {
      data: { user },
      error
    } = await supabaseAuth.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        error: "Invalid or expired authentication token"
      });
    }

    req.user = user;

    next();
  } catch (error) {
    console.error("Authentication error:", error);

    return res.status(401).json({
      error: "Authentication failed"
    });
  }
}