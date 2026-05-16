import { supabase } from '../database/supabase.js'
import { signOut } from '../database/signOut.js'
import { getCurrentUserProfile } from '../database/getUserProfile.js'

async function showAuthStatus() {
  const { data: { user } } = await supabase.auth.getUser()
  const statusBox = document.getElementById('auth-status')

  if (user) {
    // ✅ Just show the email
    statusBox.textContent = `Logged in as ${user.email}`
  } else {
    statusBox.textContent = 'Not logged in'
    window.location.href = "/frontend/index.html" // bounce back
  }
}

showAuthStatus()

// Sign Out
document.getElementById('signout-btn').addEventListener('click', async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    document.getElementById('message-box').textContent = "❌ " + error.message;
  } else {
    // ✅ Redirect back to login page
    window.location.href = "/frontend/index.html";
  }
});

async function loadPreCases() {
  const response = await fetch("http://localhost:4000/api/test");
  const json = await response.json();

  // ✅ json.inserted is the array
  document.getElementById("reddit-feed").innerHTML = json.inserted
    .map(post => `<li><a href="https://reddit.com${post.permalink}" target="_blank">${post.title}</a></li>`)
    .join("");
}

loadPreCases();

async function loadCases() {
  const response = await fetch("http://localhost:4000/api/cases");
  const cases = await response.json();

  const container = document.getElementById("cases");

  if (!cases || cases.length === 0) {
      container.innerHTML = `<p>No cases available yet.</p>`;
      return;
    }

  container.innerHTML = cases.map(c => `
    <div class="border rounded p-4 mb-4">
      <h2 class="text-xl font-bold">${c.topic}</h2>
      <p class="text-gray-700">${c.summary}</p>
      <p class="text-sm text-gray-500">Subreddits: ${c.subreddits.join(", ")}</p>
      <ul class="list-disc ml-6 mt-2">
        ${c.permalinks.map(link => `<li><a href="${link}" target="_blank" class="text-blue-600 underline">${link}</a></li>`).join("")}
      </ul>
    </div>
  `).join("");
}

loadCases();

/* async function loadRedditPosts() {
  try {
    const response = await fetch("http://localhost:4000/api/reddit");
    const json = await response.json();

    // Reddit JSON structure: json.data.children -> array of posts
    if (!json.data || !json.data.children) {
      document.getElementById("reddit-feed").innerHTML = "<li>No posts found</li>";
      return;
    }

    const posts = json.data.children.map(child => child.data);

    document.getElementById("reddit-feed").innerHTML = posts
      .slice(0, 5) // show top 5
      .map(post => `
        <li>
          <a href="https://reddit.com${post.permalink}" target="_blank">
            ${post.title}
          </a>
        </li>
      `)
      .join("");
  } catch (err) {
    console.error("Error fetching Reddit:", err);
    document.getElementById("reddit-feed").innerHTML = "<li>Error loading posts</li>";
  }
}

loadRedditPosts();*/

/*
document.addEventListener("DOMContentLoaded", () => {
  // For debugging raw intake
  // loadPreCase();

  // For showing aggregated cases
  loadCase();
});
*/