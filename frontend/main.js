import { signUp } from '../database/signUp.js'
import { signIn } from '../database/signIn.js'
import { signOut } from '../database/signOut.js'
import { listenAuthChanges } from '../database/onAuthStateChange.js'

console.log('✅ main.js loaded')

function showMessage(msg, type = 'info') {
  const box = document.getElementById('message-box')
  box.textContent = msg
  box.style.color = type === 'error' ? 'red' : 'green'
}

document.getElementById('signup-btn').addEventListener('click', () => {
  console.log('✅ Sign Up button clicked')
  document.getElementById('message-box').textContent = 'Button clicked!'
})

// Sign Up
document.getElementById('signup-btn').addEventListener('click', async () => {
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

// Sign In
document.getElementById('signin-btn').addEventListener('click', async () => {
  const email = document.getElementById('signin-email').value
  const password = document.getElementById('signin-password').value
  if (!email || !password) {
    showMessage('❌ Please enter email and password', 'error')
    return
  }
  try {
    await signIn(email, password)
    showMessage('✅ Login successful!', 'success')
  } catch (err) {
    showMessage('❌ Error: ' + err.message, 'error')
  }
})

// Sign Out
document.getElementById('signout-btn').addEventListener('click', async () => {
  try {
    await signOut()
    showMessage('✅ Logged out!', 'success')
  } catch (err) {
    showMessage('❌ Error: ' + err.message, 'error')
  }
})

// Auth state listener
listenAuthChanges((event, session) => {
  const status = document.getElementById('auth-status')
  if (session?.user) {
    status.textContent = `Logged in as: ${session.user.email}`
  } else {
    status.textContent = 'Not logged in'
  }
})