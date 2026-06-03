import { supabase } from "../database/supabase.js";

const signupBtn = document.getElementById("signup-btn");
const goLogInBtn = document.getElementById("goLogInBtn");
const messageBox = document.getElementById("message-box");

if (signupBtn) {
  signupBtn.addEventListener("click", async () => {
    const email = document.getElementById("signup-email").value;
    const password = document.getElementById("signup-password").value;

    if (!email || !password) {
      messageBox.textContent = "Please enter email and password";
      return;
    }

    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      messageBox.textContent = error.message;
    } else {
      messageBox.textContent = "Registration successful!";
      window.location.href = "/frontend/index.html";
    }
  });

  if (goLogInBtn) {
    goLogInBtn.addEventListener("click", () => {
      window.location.href = "/frontend/index.html";
    });
  }
}
