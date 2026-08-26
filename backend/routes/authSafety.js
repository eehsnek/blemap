import { Router } from "express";
import {
  loginWithPassword,
  requestPasswordReset,
  resendConfirmation,
  completePasswordReset,
  checkLoginAllowed,
  normalizeEmail,
  isValidEmail,
  getClientIp,
  validateNewPassword,
} from "../lib/authSafety.js";

const router = Router();

router.post("/login", async (req, res, next) => {
  try {
    const result = await loginWithPassword(
      req.body?.email,
      req.body?.password,
      getClientIp(req)
    );
    res.status(result.status).json(result.body);
  } catch (err) {
    next(err);
  }
});

router.post("/precheck", async (req, res, next) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Enter a valid email address.", code: "invalid" });
    }
    const gate = await checkLoginAllowed(email, getClientIp(req));
    if (gate.locked) {
      return res.status(429).json({
        error: gate.error,
        code: "locked",
        retryAfterMs: gate.remaining,
        remainingAttempts: 0,
      });
    }
    res.json({ ok: true, remainingAttempts: gate.remainingAttempts });
  } catch (err) {
    next(err);
  }
});

router.post("/forgot-password", async (req, res, next) => {
  try {
    const result = await requestPasswordReset(
      req.body?.email,
      getClientIp(req),
      req
    );
    res.status(result.status).json(result.body);
  } catch (err) {
    next(err);
  }
});

router.post("/resend-confirm", async (req, res, next) => {
  try {
    const result = await resendConfirmation(req.body?.email, getClientIp(req));
    res.status(result.status).json(result.body);
  } catch (err) {
    next(err);
  }
});

router.post("/reset-password", async (req, res, next) => {
  try {
    const result = await completePasswordReset({
      email: req.body?.email,
      otp: req.body?.otp,
      password: req.body?.password,
      confirm: req.body?.confirm,
      ip: getClientIp(req),
    });
    res.status(result.status).json(result.body);
  } catch (err) {
    next(err);
  }
});

router.post("/password-policy", (req, res) => {
  const result = validateNewPassword(req.body?.password, req.body?.confirm);
  if (result.error) return res.status(400).json({ error: result.error });
  res.json({ ok: true });
});

export default router;
