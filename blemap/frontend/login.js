import { supabase } from '../database/supabase.js';

const signinBtn = document.getElementById('signin-btn');
const goRegisterBtn = document.getElementById('goRegisterBtn');
const messageBox = document.getElementById('message-box');

if (signinBtn) {
  signinBtn.addEventListener('click', async () => {
    const email = document.getElementById('signin-email').value;
    const password = document.getElementById('signin-password').value;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      messageBox.textContent = "❌ " + error.message;
    } else {
      messageBox.textContent = "✅ Login successful!";
      // Redirect to home page after login
      window.location.href = "/frontend/home.html";
    }
  });

  if (goRegisterBtn) {
  goRegisterBtn.addEventListener('click', () => {
    window.location.href = "/frontend/register.html";
  });
}
}
