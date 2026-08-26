import { supabase } from "../supabaseClient.js";

export function mount(container) {
  wireAuthUi(container || document.getElementById("auth-screen"));
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
      showLoginForm();
    });
    tabRegister?.addEventListener("click", () => {
      setTab("register");
      showRegisterForm();
    });
    tabsWired = true;
  }

  showLoginForm();
}

function setTab(active) {
  const login = document.getElementById("tab-login");
  const reg = document.getElementById("tab-register");
  if (!login || !reg) return;
  login.className = "auth-tab" + (active === "login" ? " is-active-login" : "");
  reg.className = "auth-tab" + (active === "register" ? " is-active-register" : "");
}

function msg(text, isError = false) {
  const box = document.getElementById("message-box");
  if (!box) return;
  box.textContent = text;
  box.className = "auth-msg" + (text ? (isError ? " is-error" : " is-ok") : "");
}

function showLoginForm() {
  const forms = document.getElementById("auth-forms");
  if (!forms) return;
  forms.innerHTML = `
    <input id="signin-email" type="email" autocomplete="email" placeholder="Email" class="auth-field" />
    <input id="signin-password" type="password" autocomplete="current-password" placeholder="Password" class="auth-field" />
    <button type="button" id="signin-btn" class="auth-btn auth-btn-login">Sign In</button>
  `;

  const trySignIn = async () => {
    const email = document.getElementById("signin-email")?.value.trim();
    const password = document.getElementById("signin-password")?.value;
    const btn = document.getElementById("signin-btn");

    if (!email || !password) return msg("Enter email and password.", true);

    btn.disabled = true;
    btn.textContent = "Signing in…";
    msg("");

    let data;
    let error;
    try {
      ({ data, error } = await supabase.auth.signInWithPassword({ email, password }));
    } catch (err) {
      btn.disabled = false;
      btn.textContent = "Sign In";
      const m = err?.message || String(err);
      if (/load failed|failed to fetch|network/i.test(m)) {
        return msg(
          "Cannot reach Supabase. Use http://localhost:4000, check your network, and restart npm run dev.",
          true
        );
      }
      return msg(m, true);
    }

    btn.disabled = false;
    btn.textContent = "Sign In";

    if (error) {
      let m = error.message;
      if (m.toLowerCase().includes("email not confirmed")) {
        m = "Confirm your email first, or disable confirm-email in Supabase for dev.";
      }
      return msg(m, true);
    }

    if (data.session) {
      msg("Welcome back! Opening your workspace…");
      window.dispatchEvent(new CustomEvent("blemap:authenticated"));
    }
  };

  document.getElementById("signin-btn")?.addEventListener("click", trySignIn);
  document.getElementById("signin-password")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") trySignIn();
  });

  let foot = document.getElementById("community-auth-foot");
  if (!foot) {
    foot = document.createElement("p");
    foot.id = "community-auth-foot";
    foot.className = "steward-auth-foot";
    forms.parentElement?.appendChild(foot);
  }
  foot.innerHTML = `<button type="button" id="to-steward-login" class="steward-auth-link">Archive Steward sign-in →</button>`;
  document.getElementById("to-steward-login")?.addEventListener("click", () => {
    window.location.hash = "#/steward-login";
  });
}

function showRegisterForm() {
  const forms = document.getElementById("auth-forms");
  if (!forms) return;
  forms.innerHTML = `
    <input id="signup-email" type="email" autocomplete="email" placeholder="Email" class="auth-field" />
    <input id="signup-password" type="password" autocomplete="new-password" placeholder="Password (min 6)" minlength="6" class="auth-field" />
    <button type="button" id="signup-btn" class="auth-btn auth-btn-register">Create Account</button>
    <p class="auth-hint">Use a real email. You may need to confirm before signing in.</p>
  `;

  document.getElementById("signup-btn")?.addEventListener("click", async () => {
    const email = document.getElementById("signup-email")?.value.trim();
    const password = document.getElementById("signup-password")?.value;
    const btn = document.getElementById("signup-btn");

    if (!email || !password) return msg("Enter email and password.", true);
    if (password.length < 6) return msg("Password must be at least 6 characters.", true);

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
      return msg(error.message, true);
    }

    // Local/dev: auto-confirm when project still has Confirm email enabled
    if (!data.session && email) {
      try {
        await fetch("/api/dev/confirm-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const signedIn = await supabase.auth.signInWithPassword({ email, password });
        if (signedIn.data?.session) {
          btn.disabled = false;
          btn.textContent = "Create Account";
          msg("Account created! Opening your workspace…");
          window.dispatchEvent(new CustomEvent("blemap:authenticated"));
          return;
        }
      } catch {
        /* fall through to email-confirm message */
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
}
