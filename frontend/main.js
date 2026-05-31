import { signUp } from '../database/signUp.js'
import { signIn } from '../database/signIn.js'
import { supabase } from '../database/supabase.js'

function showMessage(msg, type = 'info') {
  const box = document.getElementById('message-box')
  box.textContent = msg
  box.style.color = type === 'error' ? 'red' : 'green'
}

// Sign Up
const signupBtn = document.getElementById('signup-btn')
if (signupBtn) {
  signupBtn.addEventListener('click', async () => {
    const email = document.getElementById('signup-email').value
    const password = document.getElementById('signup-password').value
    if (!email || !password) {
      showMessage('❌ Please enter email and password', 'error')
      return
    }
    try {
      await signUp(email, password)
      showMessage('✅ Sign up successful!', 'success')
    } catch (err) {
      showMessage('❌ Error: ' + err.message, 'error')
    }
  })
}

document.getElementById('signin-btn').addEventListener('click', async () => {
  const email = document.getElementById('signin-email').value;
  const password = document.getElementById('signin-password').value;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    document.getElementById('message-box').textContent = error.message;
  } else {
    // ✅ Redirect to home.html with absolute path
    window.location.href = "/frontend/home.html";
  }
});
