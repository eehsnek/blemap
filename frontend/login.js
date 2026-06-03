import { supabase } from "./supabaseClient.js";

const signinBtn = document.getElementById("signin-btn");
const goRegisterBtn = document.getElementById("goRegisterBtn");
const messageBox = document.getElementById("message-box");

function showMessage(text, isError = false) {
  messageBox.textContent = (isError ? "" : "✅ ") + text;
  messageBox.style.color = isError ? "#ffb779" : "#43e2d2";
}

if (signinBtn) {
  signinBtn.addEventListener("click", async () => {
    const email = document.getElementById("signin-email").value.trim();
    const password = document.getElementById("signin-password").value;

    if (!email || !password) {
      showMessage("Enter email and password.", true);
      return;
    }

    signinBtn.disabled = true;
    signinBtn.textContent = "Signing in…";

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    signinBtn.disabled = false;
    signinBtn.textContent = "Sign In";

    if (error) {
      let msg = error.message;
      if (msg.toLowerCase().includes("email not confirmed")) {
        msg =
          "Email not confirmed yet. Open the link from your sign-up email, or disable confirm-email in Supabase for local dev.";
      }
      if (msg.toLowerCase().includes("invalid login")) {
        msg = "Wrong email or password, or account not created yet.";
      }
      showMessage(msg, true);
      return;
    }

    if (data.session) {
      window.location.href = "/frontend/home.html";
    }
  });

  if (goRegisterBtn) {
    goRegisterBtn.addEventListener("click", () => {
      window.location.href = "/frontend/register.html";
    });
  }
}
