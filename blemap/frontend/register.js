import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://kktedcwrxsrkbyzxchjt.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrdGVkY3dyeHNya2J5enhjaGp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwNjMwNjQsImV4cCI6MjA5MzYzOTA2NH0.kMlmUDeAmpOnYlrUXqsuNFlJHoIFqYyrmFG8ewPHTK8";
const supabase = createClient(supabaseUrl, supabaseKey);

const signupBtn = document.getElementById('signup-btn');
const messageBox = document.getElementById('message-box');

if (signupBtn) {
  signupBtn.addEventListener('click', async () => {
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;

    if (!email || !password) {
      messageBox.textContent = "❌ Please enter email and password";
      return;
    }

    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      messageBox.textContent = "❌ " + error.message;
    } else {
      messageBox.textContent = "✅ Registration successful!";
      // Redirect to login page after sign up
      window.location.href = "/frontend/login.html";
    }
  });

  if (goLogInBtn) {
    goLogInBtn.addEventListener('click', () => {
      window.location.href = "/frontend/index.html";
    });
  }
}