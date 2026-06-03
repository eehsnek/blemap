import { supabase } from "./supabaseClient.js";
import { SUPABASE_URL } from "./config.js";

const signupBtn = document.getElementById("signup-btn");
const goLogInBtn = document.getElementById("goLogInBtn");
const messageBox = document.getElementById("message-box");

function showMessage(text, isError = false) {
  messageBox.textContent = text;
  messageBox.style.color = isError ? "#ffb779" : "#43e2d2";
}

if (!SUPABASE_URL?.startsWith("http")) {
  showMessage(
    "Auth is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY in .env and restart the server.",
    true
  );
}

if (signupBtn) {
  signupBtn.addEventListener("click", async () => {
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value;

    if (!email || !password) {
      showMessage("Please enter email and password.", true);
      return;
    }

    if (password.length < 6) {
      showMessage("Password must be at least 6 characters.", true);
      return;
    }

    signupBtn.disabled = true;
    signupBtn.textContent = "Creating account…";
    showMessage("Contacting Supabase…");

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/frontend/index.html`,
        },
      });

      if (error) {
        showMessage(formatAuthError(error), true);
        return;
      }

      if (data.session) {
        showMessage("Account created — signed in!");
        window.location.href = "/frontend/home.html";
        return;
      }

      showMessage(
        "Account created. Check your email for a confirmation link, then sign in. " +
          "(If you don't see it, check spam or ask your project admin to disable " +
          '"Confirm email" in Supabase → Authentication → Providers → Email.)'
      );
    } catch (err) {
      console.error(err);
      showMessage(
        err.message || "Sign up failed. Open the browser console for details.",
        true
      );
    } finally {
      signupBtn.disabled = false;
      signupBtn.textContent = "Sign Up";
    }
  });

  if (goLogInBtn) {
    goLogInBtn.addEventListener("click", () => {
      window.location.href = "/frontend/index.html";
    });
  }
}

function formatAuthError(error) {
  const msg = error.message || "Sign up failed";
  if (error.message?.includes("rate limit")) {
    return "Too many sign-up attempts. Wait a few minutes or disable email confirmations in Supabase for development.";
  }
  if (error.message?.includes("invalid") && error.message?.includes("Email")) {
    return "That email address was rejected. Use a real email (not @example.com).";
  }
  if (error.status === 422 || error.code === "user_already_exists") {
    return "An account with this email already exists. Try signing in.";
  }
  return msg;
}
