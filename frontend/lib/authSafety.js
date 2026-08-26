/**
 * Shared login-safety helpers for community + steward screens.
 */

export function passwordRow(id, { autocomplete, placeholder }) {
  return `
    <div class="auth-password-wrap">
      <input id="${id}" type="password" autocomplete="${autocomplete}" placeholder="${placeholder}" class="auth-field" />
      <button type="button" class="auth-show-pass" data-for="${id}" aria-label="Show password">Show</button>
    </div>
  `;
}

export function wirePasswordToggles(root) {
  root.querySelectorAll(".auth-show-pass").forEach((btn) => {
    btn.addEventListener("click", () => {
      const input = root.querySelector(`#${btn.dataset.for}`);
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      btn.textContent = show ? "Hide" : "Show";
      btn.setAttribute("aria-label", show ? "Hide password" : "Show password");
    });
  });
}

export function wireCapsLock(input, hint) {
  if (!input || !hint) return;
  const sync = (e) => {
    hint.hidden = !e.getModifierState?.("CapsLock");
  };
  input.addEventListener("keydown", sync);
  input.addEventListener("keyup", sync);
}

async function postAuth(path, body) {
  const res = await fetch(`/api/auth${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export async function loginWithSafety(email, password) {
  return postAuth("/login", { email, password });
}

export async function requestPasswordReset(email) {
  return postAuth("/forgot-password", { email });
}

export async function resendConfirmation(email) {
  return postAuth("/resend-confirm", { email });
}

export async function resetPasswordWithCode({ email, otp, password, confirm }) {
  return postAuth("/reset-password", { email, otp, password, confirm });
}

export function isPasswordRecoveryPending() {
  try {
    return sessionStorage.getItem("blemap-password-recovery") === "1";
  } catch {
    return false;
  }
}

export function markPasswordRecovery() {
  try {
    sessionStorage.setItem("blemap-password-recovery", "1");
  } catch {
    /* ignore */
  }
}

export function clearPasswordRecovery() {
  try {
    sessionStorage.removeItem("blemap-password-recovery");
  } catch {
    /* ignore */
  }
}

export function captureRecoveryFromUrl() {
  if (typeof window === "undefined") return false;
  const blob = `${window.location.hash}\n${window.location.search}`;
  if (/type=recovery/i.test(blob)) {
    markPasswordRecovery();
    return true;
  }
  return false;
}

export async function applySession(supabase, tokens) {
  if (!tokens?.access_token || !tokens?.refresh_token) return { error: "No session returned." };
  const { error } = await supabase.auth.setSession({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  });
  return { error: error?.message || null };
}

export function formatRetry(ms) {
  const mins = Math.max(1, Math.ceil(Number(ms || 0) / 60000));
  return `${mins} minute${mins === 1 ? "" : "s"}`;
}
