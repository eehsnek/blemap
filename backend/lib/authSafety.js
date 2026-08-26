import { createHash } from "node:crypto";
import { getSupabaseAdmin, getSupabaseAnon } from "./supabaseAdmin.js";
import { isProfileDisabled } from "./adminUsers.js";

export const LOGIN_POLICY = {
  maxFails: 5,
  windowMs: 15 * 60 * 1000,
  lockMs: 15 * 60 * 1000,
};

export const IP_LOGIN_POLICY = {
  maxFails: 25,
  windowMs: 15 * 60 * 1000,
  lockMs: 15 * 60 * 1000,
};

export const FORGOT_POLICY = {
  maxFails: 3,
  windowMs: 15 * 60 * 1000,
  lockMs: 15 * 60 * 1000,
};

export const GENERIC_LOGIN_ERROR = "Invalid email or password.";
export const GENERIC_FORGOT_OK =
  "If an account exists for that email, we sent reset instructions. Check your inbox and spam folder.";

const memory = new Map();

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function isValidEmail(email) {
  const e = normalizeEmail(email);
  return e.length >= 5 && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export function validateNewPassword(password, confirm) {
  const p = String(password || "");
  if (p.length < 8) return { error: "Password must be at least 8 characters." };
  if (p.length > 72) return { error: "Password is too long." };
  if (/^\s|\s$/.test(p)) return { error: "Password cannot start or end with a space." };
  if (!/[A-Za-z]/.test(p) || !/[0-9]/.test(p)) {
    return { error: "Password must include a letter and a number." };
  }
  if (confirm !== undefined && p !== String(confirm)) {
    return { error: "Passwords do not match." };
  }
  return { ok: true };
}

export function subjectKey(kind, value) {
  const hash = createHash("sha256").update(String(value || "")).digest("hex");
  return `${kind}:${hash}`;
}

export function getClientIp(req) {
  const xf = String(req.headers?.["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  return xf || req.socket?.remoteAddress || "unknown";
}

export function recoveryRedirectUrl(req, env = process.env) {
  const fallback = `http://localhost:${env.PORT || 4000}/frontend/app.html`;
  const origin = String(req.headers?.origin || "");
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
    return `${origin}/frontend/app.html`;
  }
  if (env.BLEMAP_PUBLIC_ORIGIN) {
    return `${String(env.BLEMAP_PUBLIC_ORIGIN).replace(/\/$/, "")}/frontend/app.html`;
  }
  return fallback;
}

export function isDevAuthExtras(env = process.env) {
  return env.NODE_ENV !== "production" && env.VERCEL !== "1";
}

export function inspectLock(record, now, policy = LOGIN_POLICY) {
  if (!record) {
    return {
      locked: false,
      remaining: 0,
      remainingAttempts: policy.maxFails,
    };
  }
  if (record.lockedUntil && record.lockedUntil > now) {
    return {
      locked: true,
      remaining: record.lockedUntil - now,
      remainingAttempts: 0,
    };
  }
  const windowFresh =
    !record.windowStart || now - record.windowStart > policy.windowMs;
  const fails = windowFresh ? 0 : record.failCount || 0;
  return {
    locked: false,
    remaining: 0,
    remainingAttempts: Math.max(0, policy.maxFails - fails),
  };
}

export function applyLoginFailure(record, now, policy = LOGIN_POLICY) {
  const rec = record
    ? { ...record }
    : { failCount: 0, windowStart: now, lockedUntil: 0 };

  if (rec.lockedUntil && rec.lockedUntil > now) {
    return {
      record: rec,
      locked: true,
      remaining: rec.lockedUntil - now,
      remainingAttempts: 0,
    };
  }

  if (rec.lockedUntil && rec.lockedUntil <= now) {
    rec.lockedUntil = 0;
    rec.failCount = 0;
    rec.windowStart = now;
  }

  if (now - rec.windowStart > policy.windowMs) {
    rec.failCount = 0;
    rec.windowStart = now;
  }

  rec.failCount += 1;
  rec.updatedAt = now;

  if (rec.failCount >= policy.maxFails) {
    rec.lockedUntil = now + policy.lockMs;
    return {
      record: rec,
      locked: true,
      remaining: policy.lockMs,
      remainingAttempts: 0,
    };
  }

  return {
    record: rec,
    locked: false,
    remaining: 0,
    remainingAttempts: policy.maxFails - rec.failCount,
  };
}

export function applyLoginSuccess(now) {
  return { failCount: 0, windowStart: now, lockedUntil: 0, updatedAt: now };
}

export function lockoutMessage(remainingMs) {
  const mins = Math.max(1, Math.ceil(remainingMs / 60000));
  return `Too many sign-in attempts. Try again in ${mins} minute${mins === 1 ? "" : "s"}, or reset your password.`;
}

export function forgotLockoutMessage(remainingMs) {
  const mins = Math.max(1, Math.ceil(remainingMs / 60000));
  return `Too many password-reset requests. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`;
}

async function loadRecord(key) {
  if (memory.has(key)) return memory.get(key);
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  try {
    const { data, error } = await admin
      .from("auth_lockouts")
      .select("fail_count, window_start, locked_until")
      .eq("subject_key", key)
      .maybeSingle();
    if (error || !data) return null;
    const rec = {
      failCount: data.fail_count || 0,
      windowStart: data.window_start ? new Date(data.window_start).getTime() : Date.now(),
      lockedUntil: data.locked_until ? new Date(data.locked_until).getTime() : 0,
    };
    memory.set(key, rec);
    return rec;
  } catch {
    return null;
  }
}

async function saveRecord(key, rec) {
  memory.set(key, rec);
  const admin = getSupabaseAdmin();
  if (!admin) return;
  try {
    await admin.from("auth_lockouts").upsert({
      subject_key: key,
      fail_count: rec.failCount || 0,
      window_start: new Date(rec.windowStart || Date.now()).toISOString(),
      locked_until: rec.lockedUntil
        ? new Date(rec.lockedUntil).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    });
  } catch {
    /* memory still holds the lockout */
  }
}

export async function checkLoginAllowed(email, ip, now = Date.now()) {
  const emailKey = subjectKey("login-email", normalizeEmail(email));
  const ipKey = subjectKey("login-ip", ip || "unknown");
  const [emailRec, ipRec] = await Promise.all([
    loadRecord(emailKey),
    loadRecord(ipKey),
  ]);
  const emailLock = inspectLock(emailRec, now, LOGIN_POLICY);
  if (emailLock.locked) {
    return { ...emailLock, code: "locked", error: lockoutMessage(emailLock.remaining) };
  }
  const ipLock = inspectLock(ipRec, now, IP_LOGIN_POLICY);
  if (ipLock.locked) {
    return { ...ipLock, code: "locked", error: lockoutMessage(ipLock.remaining) };
  }
  return {
    locked: false,
    remaining: 0,
    remainingAttempts: emailLock.remainingAttempts,
  };
}

export async function recordLoginFailure(email, ip, now = Date.now()) {
  const emailKey = subjectKey("login-email", normalizeEmail(email));
  const ipKey = subjectKey("login-ip", ip || "unknown");
  const emailRec = await loadRecord(emailKey);
  const applied = applyLoginFailure(emailRec, now, LOGIN_POLICY);
  await saveRecord(emailKey, applied.record);

  const ipRec = await loadRecord(ipKey);
  const ipApplied = applyLoginFailure(ipRec, now, IP_LOGIN_POLICY);
  await saveRecord(ipKey, ipApplied.record);

  if (applied.locked) {
    return {
      locked: true,
      remaining: applied.remaining,
      remainingAttempts: 0,
      code: "locked",
      error: lockoutMessage(applied.remaining),
    };
  }
  return {
    locked: false,
    remaining: 0,
    remainingAttempts: applied.remainingAttempts,
    code: "invalid",
    error: GENERIC_LOGIN_ERROR,
  };
}

export async function recordLoginSuccess(email, now = Date.now()) {
  const emailKey = subjectKey("login-email", normalizeEmail(email));
  await saveRecord(emailKey, applyLoginSuccess(now));
}

async function checkForgotAllowed(email, ip, now = Date.now()) {
  const emailKey = subjectKey("forgot-email", normalizeEmail(email));
  const ipKey = subjectKey("forgot-ip", ip || "unknown");
  const [emailRec, ipRec] = await Promise.all([
    loadRecord(emailKey),
    loadRecord(ipKey),
  ]);
  const emailLock = inspectLock(emailRec, now, FORGOT_POLICY);
  if (emailLock.locked) {
    return { allowed: false, error: forgotLockoutMessage(emailLock.remaining), remaining: emailLock.remaining };
  }
  const ipLock = inspectLock(ipRec, now, {
    ...FORGOT_POLICY,
    maxFails: 10,
  });
  if (ipLock.locked) {
    return { allowed: false, error: forgotLockoutMessage(ipLock.remaining), remaining: ipLock.remaining };
  }
  return { allowed: true };
}

async function recordForgotRequest(email, ip, now = Date.now()) {
  const emailKey = subjectKey("forgot-email", normalizeEmail(email));
  const ipKey = subjectKey("forgot-ip", ip || "unknown");
  const emailRec = await loadRecord(emailKey);
  const applied = applyLoginFailure(emailRec, now, FORGOT_POLICY);
  await saveRecord(emailKey, applied.record);
  const ipRec = await loadRecord(ipKey);
  const ipApplied = applyLoginFailure(ipRec, now, { ...FORGOT_POLICY, maxFails: 10 });
  await saveRecord(ipKey, ipApplied.record);
}

export async function loginWithPassword(email, password, ip) {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized) || !password) {
    return { status: 400, body: { error: "Enter email and password.", code: "invalid" } };
  }

  const gate = await checkLoginAllowed(normalized, ip);
  if (gate.locked) {
    return {
      status: 429,
      body: {
        error: gate.error,
        code: "locked",
        retryAfterMs: gate.remaining,
        remainingAttempts: 0,
      },
    };
  }

  const anon = getSupabaseAnon();
  if (!anon) {
    return {
      status: 503,
      body: {
        error:
          "Sign-in is unavailable. Set SUPABASE_URL and SUPABASE_ANON_KEY, then restart the server.",
        code: "config",
      },
    };
  }

  const { data, error } = await anon.auth.signInWithPassword({
    email: normalized,
    password,
  });

  if (error) {
    const msg = String(error.message || "");
    if (/email not confirmed/i.test(msg)) {
      return {
        status: 403,
        body: {
          error: "Confirm your email before signing in. We can resend the confirmation message.",
          code: "unconfirmed",
          remainingAttempts: gate.remainingAttempts,
        },
      };
    }
    const fail = await recordLoginFailure(normalized, ip);
    const warn =
      !fail.locked && fail.remainingAttempts <= 2
        ? ` ${fail.remainingAttempts} attempt${fail.remainingAttempts === 1 ? "" : "s"} left before a temporary lockout.`
        : "";
    return {
      status: fail.locked ? 429 : 401,
      body: {
        error: fail.error + warn,
        code: fail.code,
        retryAfterMs: fail.remaining || 0,
        remainingAttempts: fail.remainingAttempts,
      },
    };
  }

  if (!data?.session) {
    return {
      status: 401,
      body: { error: GENERIC_LOGIN_ERROR, code: "invalid" },
    };
  }

  if (await isProfileDisabled(data.user.id)) {
    await anon.auth.signOut();
    return {
      status: 403,
      body: {
        error: "This account is disabled. Contact an Archive Steward if you need access restored.",
        code: "disabled",
      },
    };
  }

  await recordLoginSuccess(normalized);

  return {
    status: 200,
    body: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: { id: data.user.id, email: data.user.email },
    },
  };
}

export async function requestPasswordReset(email, ip, req) {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) {
    return { status: 400, body: { error: "Enter a valid email address.", code: "invalid" } };
  }

  const gate = await checkForgotAllowed(normalized, ip);
  if (!gate.allowed) {
    return {
      status: 429,
      body: {
        error: gate.error,
        code: "locked",
        retryAfterMs: gate.remaining,
      },
    };
  }

  await recordForgotRequest(normalized, ip);

  const admin = getSupabaseAdmin();
  const redirectTo = recoveryRedirectUrl(req);
  let recoveryUrl = null;
  let otp = null;

  if (admin) {
    try {
      const { data } = await admin.auth.admin.generateLink({
        type: "recovery",
        email: normalized,
        options: { redirectTo },
      });
      recoveryUrl = data?.properties?.action_link || null;
      otp = data?.properties?.email_otp || null;
    } catch {
      /* still return generic success */
    }
  }

  const body = {
    ok: true,
    message: GENERIC_FORGOT_OK,
  };

  if (isDevAuthExtras() && (recoveryUrl || otp)) {
    body.dev = {
      recoveryUrl,
      otp,
      hint: "Local only — use the code or open the reset link. Production sends email only.",
    };
  }

  return { status: 200, body };
}

export async function resendConfirmation(email, ip) {
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) {
    return { status: 400, body: { error: "Enter a valid email address.", code: "invalid" } };
  }

  const gate = await checkForgotAllowed(normalized, ip);
  if (!gate.allowed) {
    return {
      status: 429,
      body: { error: gate.error, code: "locked", retryAfterMs: gate.remaining },
    };
  }
  await recordForgotRequest(normalized, ip);

  const anon = getSupabaseAnon();
  if (anon) {
    try {
      await anon.auth.resend({ type: "signup", email: normalized });
    } catch {
      /* generic */
    }
  }

  return {
    status: 200,
    body: {
      ok: true,
      message: "If that email still needs confirmation, we sent a new message.",
    },
  };
}

export async function completePasswordReset({ email, otp, password, confirm, ip }) {
  const policy = validateNewPassword(password, confirm);
  if (policy.error) {
    return { status: 400, body: { error: policy.error, code: "invalid" } };
  }

  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized) || !otp) {
    return {
      status: 400,
      body: { error: "Enter the email and reset code from your message.", code: "invalid" },
    };
  }

  const loginGate = await checkLoginAllowed(normalized, ip);
  if (loginGate.locked) {
    return {
      status: 429,
      body: {
        error: loginGate.error,
        code: "locked",
        retryAfterMs: loginGate.remaining,
      },
    };
  }

  const anon = getSupabaseAnon();
  if (!anon) {
    return {
      status: 503,
      body: { error: "Password reset is unavailable until Supabase is configured.", code: "config" },
    };
  }

  const { data, error } = await anon.auth.verifyOtp({
    email: normalized,
    token: String(otp).trim(),
    type: "recovery",
  });

  if (error || !data?.session) {
    const fail = await recordLoginFailure(normalized, ip);
    return {
      status: fail.locked ? 429 : 400,
      body: {
        error: fail.locked
          ? fail.error
          : "That reset code is invalid or expired. Request a new one.",
        code: fail.locked ? "locked" : "invalid",
        retryAfterMs: fail.remaining || 0,
      },
    };
  }

  const { error: updErr } = await anon.auth.updateUser({ password });
  if (updErr) {
    return {
      status: 400,
      body: { error: updErr.message || "Could not update password.", code: "invalid" },
    };
  }

  await recordLoginSuccess(normalized);

  if (await isProfileDisabled(data.user?.id)) {
    await anon.auth.signOut();
    return {
      status: 403,
      body: {
        error: "Password updated, but this account is disabled. Contact an Archive Steward.",
        code: "disabled",
      },
    };
  }

  return {
    status: 200,
    body: {
      ok: true,
      message: "Password updated. You are signed in.",
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      user: { id: data.user.id, email: data.user.email },
    },
  };
}

/** Test helper — clears in-memory lockouts. */
export function resetAuthSafetyMemory() {
  memory.clear();
}
