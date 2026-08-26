import { supabase } from "../supabaseClient.js";
import { apiFetch } from "../api.js";
import { navigate } from "../router.js";
import {
  passwordRow,
  wirePasswordToggles,
  wireCapsLock,
  loginWithSafety,
  requestPasswordReset,
  applySession,
  resendConfirmation,
} from "../lib/authSafety.js";

/**
 * Dedicated Archive Steward login (no register).
 * After password auth, requires profiles.roles.name === admin (or allowlist).
 */
export function mount(container) {
  if (!container) return () => {};

  container.innerHTML = `
    <div class="auth-page steward-auth-page">
      <section class="auth-card-wrap steward-auth-card">
        <div class="auth-brand">
          <img src="/frontend/assets/logo.jpeg" alt="BleMap" width="88" height="88" />
          <p class="steward-auth-eyebrow">Living Archive</p>
          <h1>Archive Steward</h1>
          <p>Restricted sign-in for curators who publish, hide, and unclaim cases. Community accounts use the main BleMap login.</p>
          <span class="steward-auth-seal" aria-hidden="true">Steward access</span>
        </div>
        <div class="auth-panel steward-auth-panel">
          <div id="steward-auth-forms"></div>
          <div id="steward-message-box" class="auth-msg"></div>
          <p class="steward-auth-foot">
            <button type="button" id="steward-to-community" class="steward-auth-link">← Community sign-in</button>
          </p>
        </div>
      </section>
    </div>
  `;

  const forms = container.querySelector("#steward-auth-forms");
  const msg = (text, isError = false) => {
    const box = container.querySelector("#steward-message-box");
    if (!box) return;
    box.textContent = text;
    box.className = "auth-msg" + (text ? (isError ? " is-error" : " is-ok") : "");
  };

  async function finishStewardSession(email) {
    const me = await apiFetch("/me");
    if (!me?.isAdmin) {
      await supabase.auth.signOut();
      throw new Error(
        "This account is not an Archive Steward. Ask an operator to grant the admin role in the database."
      );
    }
    msg("Steward verified. Opening the desk…");
    window.dispatchEvent(
      new CustomEvent("blemap:steward-authenticated", {
        detail: { email },
      })
    );
  }

  function showStewardLogin() {
    forms.innerHTML = `
      <label class="steward-auth-label" for="steward-email">Steward email</label>
      <input id="steward-email" type="email" autocomplete="username" placeholder="steward@…" class="auth-field" />
      <label class="steward-auth-label" for="steward-password">Password</label>
      ${passwordRow("steward-password", { autocomplete: "current-password", placeholder: "Password" })}
      <p id="steward-caps-hint" class="auth-caps-hint" hidden>Caps Lock is on</p>
      <div class="auth-toolbar">
        <button type="button" id="steward-forgot-btn" class="auth-link-btn">Forgot password?</button>
      </div>
      <button type="button" id="steward-signin-btn" class="auth-btn steward-auth-btn">Enter Steward desk</button>
    `;
    wirePasswordToggles(forms);
    wireCapsLock(forms.querySelector("#steward-password"), forms.querySelector("#steward-caps-hint"));

    const trySignIn = async () => {
      const email = container.querySelector("#steward-email")?.value.trim();
      const password = container.querySelector("#steward-password")?.value;
      const btn = container.querySelector("#steward-signin-btn");
      if (!email || !password) return msg("Enter steward email and password.", true);

      btn.disabled = true;
      btn.textContent = "Verifying steward…";
      msg("");

      let result;
      try {
        result = await loginWithSafety(email, password);
      } catch {
        btn.disabled = false;
        btn.textContent = "Enter Steward desk";
        return msg("Cannot reach BleMap. Use http://localhost:4000 and restart the server.", true);
      }

      if (!result.ok) {
        btn.disabled = false;
        btn.textContent = "Enter Steward desk";
        msg(result.data.error || "Invalid email or password.", true);
        if (result.data.code === "unconfirmed") {
          const box = container.querySelector("#steward-message-box");
          const resend = document.createElement("button");
          resend.type = "button";
          resend.className = "auth-link-btn";
          resend.textContent = "Resend confirmation email";
          resend.addEventListener("click", async () => {
            const r = await resendConfirmation(email);
            msg(r.data.message || r.data.error || "If that email needs confirmation, we sent a new message.", !r.ok);
          });
          box?.appendChild(document.createElement("br"));
          box?.appendChild(resend);
        }
        return;
      }

      const applied = await applySession(supabase, result.data);
      if (applied.error) {
        btn.disabled = false;
        btn.textContent = "Enter Steward desk";
        return msg(applied.error, true);
      }

      try {
        await finishStewardSession(email);
      } catch (err) {
        btn.disabled = false;
        btn.textContent = "Enter Steward desk";
        return msg(err.message || "Could not verify steward role.", true);
      }
    };

    container.querySelector("#steward-signin-btn")?.addEventListener("click", trySignIn);
    container.querySelector("#steward-password")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") trySignIn();
    });
    container.querySelector("#steward-forgot-btn")?.addEventListener("click", showStewardForgot);
  }

  function showStewardForgot() {
    forms.innerHTML = `
      <h2 class="auth-subhead">Reset steward password</h2>
      <p class="auth-hint">We send instructions only if this email is registered. The response is the same either way.</p>
      <label class="steward-auth-label" for="steward-forgot-email">Steward email</label>
      <input id="steward-forgot-email" type="email" autocomplete="username" placeholder="steward@…" class="auth-field" />
      <button type="button" id="steward-forgot-send" class="auth-btn steward-auth-btn">Send reset instructions</button>
      <div id="steward-dev-box" class="auth-dev-box" hidden></div>
      <p class="steward-auth-foot">
        <button type="button" id="steward-forgot-back" class="steward-auth-link">← Back to steward sign-in</button>
      </p>
    `;

    const send = async () => {
      const email = container.querySelector("#steward-forgot-email")?.value.trim();
      const btn = container.querySelector("#steward-forgot-send");
      if (!email) return msg("Enter steward email.", true);
      btn.disabled = true;
      btn.textContent = "Sending…";
      const result = await requestPasswordReset(email);
      btn.disabled = false;
      btn.textContent = "Send reset instructions";
      msg(result.data.message || result.data.error || "If an account exists, we sent reset instructions.", !result.ok);
      const box = container.querySelector("#steward-dev-box");
      if (box && result.ok && result.data.dev) {
        box.hidden = false;
        const otp = result.data.dev.otp
          ? `<p><strong>Local reset code:</strong> <code>${result.data.dev.otp}</code></p>`
          : "";
        box.innerHTML = `${otp}<p class="auth-hint">Open community sign-in → I have a reset code, or use the code on <a class="auth-inline-link" href="#/reset-password">#/reset-password</a>.</p>`;
      }
    };

    container.querySelector("#steward-forgot-send")?.addEventListener("click", send);
    container.querySelector("#steward-forgot-email")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") send();
    });
    container.querySelector("#steward-forgot-back")?.addEventListener("click", () => {
      msg("");
      showStewardLogin();
    });
  }

  showStewardLogin();

  container.querySelector("#steward-to-community")?.addEventListener("click", () => {
    navigate("login");
  });

  return () => {
    container.innerHTML = "";
  };
}
