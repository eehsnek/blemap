import { supabase } from "../supabaseClient.js";
import { navigate, parseRoute } from "../router.js";
import {
  passwordRow,
  wirePasswordToggles,
  wireCapsLock,
  loginWithSafety,
  requestPasswordReset,
  resendConfirmation,
  resetPasswordWithCode,
  applySession,
  clearPasswordRecovery,
  isPasswordRecoveryPending,
} from "../lib/authSafety.js";

export function mount(container) {
  wireAuthUi(container || document.getElementById("auth-screen"));
  syncAuthPanel(parseRoute().name);
  return () => {};
}

let tabsWired = false;

export function wireAuthUi(root) {
  if (!root) return;

  const tabLogin = root.querySelector("#tab-login") || document.getElementById("tab-login");
  const tabRegister = root.querySelector("#tab-register") || document.getElementById("tab-register");

  if (!tabsWired) {
    tabLogin?.addEventListener("click", () => {
      setTab("login");
      navigate("login");
      showLoginForm();
    });
    tabRegister?.addEventListener("click", () => {
      setTab("register");
      navigate("register");
      showRegisterForm();
    });
    tabsWired = true;
  }

  syncAuthPanel(parseRoute().name);
}

export function syncAuthPanel(name) {
  if (name === "forgot-password") {
    setTab("login");
    showForgotForm();
    return;
  }
  if (name === "reset-password" || isPasswordRecoveryPending()) {
    setTab("login");
    showResetForm();
    return;
  }
  if (name === "register") {
    setTab("register");
    showRegisterForm();
    return;
  }
  setTab("login");
  showLoginForm();
}

function setTab(active) {
  const login = document.getElementById("tab-login");
  const reg = document.getElementById("tab-register");
  if (!login || !reg) return;
  login.className = "auth-tab" + (active === "login" ? " is-active-login" : "");
  reg.className = "auth-tab" + (active === "register" ? " is-active-register" : "");
}

function setTabsVisible(visible) {
  const tabs = document.querySelector("#auth-screen .auth-tabs");
  if (tabs) tabs.style.display = visible ? "flex" : "none";
}

function msg(text, isError = false) {
  const box = document.getElementById("message-box");
  if (!box) return;
  box.textContent = text;
  box.className = "auth-msg" + (text ? (isError ? " is-error" : " is-ok") : "");
}

function setCommunityFoot(html) {
  const forms = document.getElementById("auth-forms");
  let foot = document.getElementById("community-auth-foot");
  if (!foot) {
    foot = document.createElement("p");
    foot.id = "community-auth-foot";
    foot.className = "steward-auth-foot";
    forms?.parentElement?.appendChild(foot);
  }
  foot.innerHTML = html;
}

function showResend(email) {
  const box = document.getElementById("message-box");
  if (!box || !email) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "auth-link-btn";
  btn.textContent = "Resend confirmation email";
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    const result = await resendConfirmation(email);
    msg(result.data.message || result.data.error || "If that email needs confirmation, we sent a new message.", !result.ok);
  });
  box.appendChild(document.createElement("br"));
  box.appendChild(btn);
}

function escapeAttr(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function showLoginForm() {
  const forms = document.getElementById("auth-forms");
  if (!forms) return;
  setTabsVisible(true);
  forms.innerHTML = `
    <label class="steward-auth-label" for="signin-email">Email</label>
    <input id="signin-email" type="email" autocomplete="username" placeholder="Email" class="auth-field" />
    <label class="steward-auth-label" for="signin-password">Password</label>
    ${passwordRow("signin-password", { autocomplete: "current-password", placeholder: "Password" })}
    <p id="caps-hint" class="auth-caps-hint" hidden>Caps Lock is on</p>
    <div class="auth-toolbar">
      <button type="button" id="forgot-password-btn" class="auth-link-btn">Forgot password?</button>
    </div>
    <button type="button" id="signin-btn" class="auth-btn auth-btn-login">Sign In</button>
  `;
  wirePasswordToggles(forms);
  wireCapsLock(forms.querySelector("#signin-password"), forms.querySelector("#caps-hint"));

  const trySignIn = async () => {
    const email = document.getElementById("signin-email")?.value.trim();
    const password = document.getElementById("signin-password")?.value;
    const btn = document.getElementById("signin-btn");

    if (!email || !password) return msg("Enter email and password.", true);

    btn.disabled = true;
    btn.textContent = "Signing in…";
    msg("");

    let result;
    try {
      result = await loginWithSafety(email, password);
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "Sign In";
      return msg(
        "Cannot reach BleMap. Use http://localhost:4000 and restart the server.",
        true
      );
    }

    if (!result.ok) {
      btn.disabled = false;
      btn.textContent = "Sign In";
      msg(result.data.error || "Invalid email or password.", true);
      if (result.data.code === "unconfirmed") showResend(email);
      if (result.data.code === "locked") {
        const forgot = document.getElementById("forgot-password-btn");
        forgot?.focus();
      }
      return;
    }

    const applied = await applySession(supabase, result.data);
    btn.disabled = false;
    btn.textContent = "Sign In";
    if (applied.error) return msg(applied.error, true);

    msg("Welcome back! Opening your workspace…");
    window.dispatchEvent(new CustomEvent("blemap:authenticated"));
  };

  document.getElementById("signin-btn")?.addEventListener("click", trySignIn);
  document.getElementById("signin-password")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") trySignIn();
  });
  document.getElementById("signin-email")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") trySignIn();
  });
  document.getElementById("forgot-password-btn")?.addEventListener("click", () => {
    navigate("forgot-password");
    showForgotForm();
  });

  setCommunityFoot(
    `<button type="button" id="to-steward-login" class="steward-auth-link">Archive Steward sign-in →</button>`
  );
  document.getElementById("to-steward-login")?.addEventListener("click", () => {
    window.location.hash = "#/steward-login";
  });
}

function showRegisterForm() {
  const forms = document.getElementById("auth-forms");
  if (!forms) return;
  setTabsVisible(true);
  forms.innerHTML = `
    <label class="steward-auth-label" for="signup-email">Email</label>
    <input id="signup-email" type="email" autocomplete="username" placeholder="Email" class="auth-field" />
    <label class="steward-auth-label" for="signup-password">Password</label>
    ${passwordRow("signup-password", { autocomplete: "new-password", placeholder: "Password (min 8, letter + number)" })}
    <label class="steward-auth-label" for="signup-password-confirm">Confirm password</label>
    ${passwordRow("signup-password-confirm", { autocomplete: "new-password", placeholder: "Confirm password" })}
    <p id="caps-hint" class="auth-caps-hint" hidden>Caps Lock is on</p>
    <button type="button" id="signup-btn" class="auth-btn auth-btn-register">Create Account</button>
    <p class="auth-hint">Use a real email. You may need to confirm before signing in.</p>
  `;
  wirePasswordToggles(forms);
  wireCapsLock(forms.querySelector("#signup-password"), forms.querySelector("#caps-hint"));

  document.getElementById("signup-btn")?.addEventListener("click", async () => {
    const email = document.getElementById("signup-email")?.value.trim();
    const password = document.getElementById("signup-password")?.value;
    const confirm = document.getElementById("signup-password-confirm")?.value;
    const btn = document.getElementById("signup-btn");

    if (!email || !password) return msg("Enter email and password.", true);
    if (password.length < 8) return msg("Password must be at least 8 characters.", true);
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      return msg("Password must include a letter and a number.", true);
    }
    if (password !== confirm) return msg("Passwords do not match.", true);

    btn.disabled = true;
    btn.textContent = "Creating…";

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/frontend/app.html` },
    });

    if (error) {
      btn.disabled = false;
      btn.textContent = "Create Account";
      const m = error.message || "";
      if (/already registered|already exists/i.test(m)) {
        return msg("Could not create that account. Sign in, or reset your password if you already registered.", true);
      }
      return msg(m, true);
    }

    if (!data.session && email) {
      try {
        await fetch("/api/dev/confirm-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const signedIn = await loginWithSafety(email, password);
        if (signedIn.ok) {
          await applySession(supabase, signedIn.data);
          btn.disabled = false;
          btn.textContent = "Create Account";
          msg("Account created! Opening your workspace…");
          window.dispatchEvent(new CustomEvent("blemap:authenticated"));
          return;
        }
      } catch {
        /* fall through */
      }
    }

    btn.disabled = false;
    btn.textContent = "Create Account";

    if (data.session) {
      msg("Account created! Opening your workspace…");
      window.dispatchEvent(new CustomEvent("blemap:authenticated"));
      return;
    }

    msg("Account created. Check your email to confirm, then sign in.");
    setTab("login");
    showLoginForm();
  });

  setCommunityFoot(
    `<button type="button" id="to-steward-login" class="steward-auth-link">Archive Steward sign-in →</button>`
  );
  document.getElementById("to-steward-login")?.addEventListener("click", () => {
    window.location.hash = "#/steward-login";
  });
}

export function showForgotForm() {
  const forms = document.getElementById("auth-forms");
  if (!forms) return;
  setTabsVisible(false);
  forms.innerHTML = `
    <h2 class="auth-subhead">Reset password</h2>
    <p class="auth-hint">Enter the email on your account. We send a reset code if that address exists — we will not say whether it does.</p>
    <label class="steward-auth-label" for="forgot-email">Email</label>
    <input id="forgot-email" type="email" autocomplete="username" placeholder="Email" class="auth-field" />
    <button type="button" id="forgot-send-btn" class="auth-btn auth-btn-login">Send reset instructions</button>
    <div id="forgot-dev-box" class="auth-dev-box" hidden></div>
  `;

  const send = async () => {
    const email = document.getElementById("forgot-email")?.value.trim();
    const btn = document.getElementById("forgot-send-btn");
    if (!email) return msg("Enter the email for your account.", true);

    btn.disabled = true;
    btn.textContent = "Sending…";
    msg("");

    const result = await requestPasswordReset(email);
    btn.disabled = false;
    btn.textContent = "Send reset instructions";
    msg(result.data.message || result.data.error || "If an account exists, we sent reset instructions.", !result.ok);

    const box = document.getElementById("forgot-dev-box");
    if (box && result.ok && result.data.dev) {
      box.hidden = false;
      const rawLink = result.data.dev.recoveryUrl || "";
      const safeLink = /^https?:\/\//i.test(rawLink) ? rawLink : "";
      const otp = result.data.dev.otp
        ? `<p><strong>Local reset code:</strong> <code>${escapeAttr(result.data.dev.otp)}</code></p>`
        : "";
      const link = safeLink
        ? `<p><a class="auth-inline-link" href="${escapeAttr(safeLink)}">Open reset link</a></p>`
        : "";
      box.innerHTML = `${otp}${link}<p class="auth-hint">Local only — production sends email, never this box.</p>
        <button type="button" id="goto-reset-btn" class="auth-link-btn">I have a reset code →</button>`;
      document.getElementById("goto-reset-btn")?.addEventListener("click", () => {
        navigate("reset-password");
        showResetForm({ email, otp: result.data.dev.otp });
      });
    } else if (result.ok) {
      navigate("reset-password");
      showResetForm({ email });
    }
  };

  document.getElementById("forgot-send-btn")?.addEventListener("click", send);
  document.getElementById("forgot-email")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") send();
  });

  setCommunityFoot(
    `<button type="button" id="forgot-back" class="steward-auth-link">← Back to sign in</button>`
  );
  document.getElementById("forgot-back")?.addEventListener("click", () => {
    navigate("login");
    showLoginForm();
  });
}

export function showResetForm(prefill = {}) {
  const forms = document.getElementById("auth-forms");
  if (!forms) return;
  setTabsVisible(false);
  const recoverySession = isPasswordRecoveryPending();
  forms.innerHTML = `
    <h2 class="auth-subhead">Choose a new password</h2>
    <p class="auth-hint">${
      recoverySession
        ? "Your reset link is verified. Set a new password to continue."
        : "Enter the email, the reset code from your message, and a new password."
    }</p>
    <label class="steward-auth-label" for="reset-email">Email</label>
    <input id="reset-email" type="email" autocomplete="username" placeholder="Email" class="auth-field" value="${escapeAttr(prefill.email)}" />
    ${
      recoverySession
        ? ""
        : `<label class="steward-auth-label" for="reset-otp">Reset code</label>
           <input id="reset-otp" type="text" inputmode="numeric" autocomplete="one-time-code" placeholder="6-digit code" class="auth-field" value="${escapeAttr(prefill.otp)}" />`
    }
    <label class="steward-auth-label" for="reset-password">New password</label>
    ${passwordRow("reset-password", { autocomplete: "new-password", placeholder: "New password (min 8, letter + number)" })}
    <label class="steward-auth-label" for="reset-password-confirm">Confirm new password</label>
    ${passwordRow("reset-password-confirm", { autocomplete: "new-password", placeholder: "Confirm new password" })}
    <p id="caps-hint" class="auth-caps-hint" hidden>Caps Lock is on</p>
    <button type="button" id="reset-save-btn" class="auth-btn auth-btn-login">Update password</button>
  `;
  wirePasswordToggles(forms);
  wireCapsLock(forms.querySelector("#reset-password"), forms.querySelector("#caps-hint"));

  const save = async () => {
    const email = document.getElementById("reset-email")?.value.trim();
    const otp = document.getElementById("reset-otp")?.value.trim();
    const password = document.getElementById("reset-password")?.value;
    const confirm = document.getElementById("reset-password-confirm")?.value;
    const btn = document.getElementById("reset-save-btn");

    if (password !== confirm) return msg("Passwords do not match.", true);
    if (password.length < 8) return msg("Password must be at least 8 characters.", true);

    btn.disabled = true;
    btn.textContent = "Updating…";
    msg("");

    if (recoverySession) {
      const { error } = await supabase.auth.updateUser({ password });
      btn.disabled = false;
      btn.textContent = "Update password";
      if (error) return msg(error.message || "Could not update password. Request a new reset link.", true);
      clearPasswordRecovery();
      msg("Password updated. Opening your workspace…");
      window.dispatchEvent(new CustomEvent("blemap:authenticated"));
      return;
    }

    const result = await resetPasswordWithCode({ email, otp, password, confirm });
    btn.disabled = false;
    btn.textContent = "Update password";
    if (!result.ok) return msg(result.data.error || "Could not update password.", true);

    const applied = await applySession(supabase, result.data);
    if (applied.error) return msg(applied.error, true);
    clearPasswordRecovery();
    msg(result.data.message || "Password updated. Opening your workspace…");
    window.dispatchEvent(new CustomEvent("blemap:authenticated"));
  };

  document.getElementById("reset-save-btn")?.addEventListener("click", save);
  forms.querySelector("#reset-password-confirm")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") save();
  });

  setCommunityFoot(
    `<button type="button" id="reset-back" class="steward-auth-link">← Back to sign in</button>
     <button type="button" id="reset-to-forgot" class="steward-auth-link">Need a new code?</button>`
  );
  document.getElementById("reset-back")?.addEventListener("click", () => {
    navigate("login");
    showLoginForm();
  });
  document.getElementById("reset-to-forgot")?.addEventListener("click", () => {
    navigate("forgot-password");
    showForgotForm();
  });
}
