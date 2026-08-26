import { supabase } from "../supabaseClient.js";
import { apiFetch } from "../api.js";
import { navigate } from "../router.js";

function demoStewardEnabled() {
  return Boolean(window.__BLEMAP_CONFIG?.demoSteward);
}

function demoStewardEmail() {
  return (
    window.__BLEMAP_CONFIG?.demoStewardEmail || "steward.demo@blemap.local"
  );
}

/**
 * Dedicated Archive Steward login (no register).
 * After password auth, requires profiles.roles.name === admin (or allowlist).
 * Local/demo: one-click Demo Steward provisions + signs in.
 */
export function mount(container) {
  if (!container) return () => {};

  const showDemo = demoStewardEnabled();

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
          ${
            showDemo
              ? `<button type="button" id="steward-demo-btn" class="auth-btn steward-demo-btn">
                   Demo Steward login
                 </button>
                 <p class="steward-demo-hint">Local only · ${escapeText(demoStewardEmail())}</p>
                 <div class="steward-auth-divider"><span>or use your steward account</span></div>`
              : ""
          }
          <div id="steward-auth-forms">
            <label class="steward-auth-label" for="steward-email">Steward email</label>
            <input id="steward-email" type="email" autocomplete="username" placeholder="steward@…" class="auth-field" value="${showDemo ? escapeAttr(demoStewardEmail()) : ""}" />
            <label class="steward-auth-label" for="steward-password">Password</label>
            <input id="steward-password" type="password" autocomplete="current-password" placeholder="Password" class="auth-field" />
            <button type="button" id="steward-signin-btn" class="auth-btn steward-auth-btn">Enter Steward desk</button>
          </div>
          <div id="steward-message-box" class="auth-msg"></div>
          <p class="steward-auth-foot">
            <button type="button" id="steward-to-community" class="steward-auth-link">← Community sign-in</button>
          </p>
        </div>
      </section>
    </div>
  `;

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

  const trySignIn = async () => {
    const email = container.querySelector("#steward-email")?.value.trim();
    const password = container.querySelector("#steward-password")?.value;
    const btn = container.querySelector("#steward-signin-btn");
    if (!email || !password) return msg("Enter steward email and password.", true);

    btn.disabled = true;
    btn.textContent = "Verifying steward…";
    msg("");

    let data;
    let error;
    try {
      ({ data, error } = await supabase.auth.signInWithPassword({ email, password }));
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "Enter Steward desk";
      const m = err?.message || String(err);
      if (/load failed|failed to fetch|network/i.test(m)) {
        return msg(
          "Cannot reach Supabase. Use http://localhost:4000 and restart the server.",
          true
        );
      }
      return msg(m, true);
    }

    if (error) {
      btn.disabled = false;
      btn.textContent = "Enter Steward desk";
      let m = error.message;
      if (m.toLowerCase().includes("email not confirmed")) {
        m = "Confirm your email first, or disable confirm-email in Supabase for dev.";
      }
      return msg(m, true);
    }

    if (!data.session) {
      btn.disabled = false;
      btn.textContent = "Enter Steward desk";
      return msg("Sign-in failed — no session.", true);
    }

    try {
      await finishStewardSession(email);
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "Enter Steward desk";
      return msg(err.message || "Could not verify steward role.", true);
    }
  };

  const tryDemoLogin = async () => {
    const btn = container.querySelector("#steward-demo-btn");
    const signBtn = container.querySelector("#steward-signin-btn");
    if (!btn) return;

    btn.disabled = true;
    if (signBtn) signBtn.disabled = true;
    btn.textContent = "Provisioning demo steward…";
    msg("");

    try {
      const res = await fetch("/api/dev/demo-steward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || `Demo steward failed (${res.status})`);
      }

      const emailEl = container.querySelector("#steward-email");
      const passEl = container.querySelector("#steward-password");
      if (emailEl) emailEl.value = body.email || "";
      if (passEl) passEl.value = body.password || "";

      btn.textContent = "Signing in…";
      const { data, error } = await supabase.auth.signInWithPassword({
        email: body.email,
        password: body.password,
      });
      if (error) throw error;
      if (!data.session) throw new Error("Demo sign-in produced no session");

      await finishStewardSession(body.email);
    } catch (err) {
      msg(err.message || "Demo steward login failed", true);
      btn.disabled = false;
      btn.textContent = "Demo Steward login";
      if (signBtn) signBtn.disabled = false;
    }
  };

  container.querySelector("#steward-signin-btn")?.addEventListener("click", trySignIn);
  container.querySelector("#steward-password")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") trySignIn();
  });
  container.querySelector("#steward-demo-btn")?.addEventListener("click", tryDemoLogin);
  container.querySelector("#steward-to-community")?.addEventListener("click", () => {
    navigate("login");
  });

  return () => {
    container.innerHTML = "";
  };
}

function escapeText(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(s) {
  return escapeText(s).replace(/"/g, "&quot;");
}
