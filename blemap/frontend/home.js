import { signOut } from "../database/signOut.js";
import { getCurrentUserProfile } from "../database/getUserProfile.js";

console.log("HOME.JS LOADED");

document.body.insertAdjacentHTML(
  "beforeend",
  "<h1>HOME TEST</h1>"
);

import { supabase } from "./supabase.js";

console.log("SUPABASE CLIENT LOADED");

const {
  data: { session },
  error
} = await supabase.auth.getSession();

console.log("SESSION:", session);
console.log("SESSION ERROR:", error);
/*
import { supabase } from './supabase.js';
import { signOut } from '../database/signOut.js'
import { getCurrentUserProfile } from '../database/getUserProfile.js'

let hasLoaded = false;

async function showAuthStatus() {
  const {
    data: { session },
    error
  } = await supabase.auth.getSession();

  console.log("HOME SESSION:", session);
  console.log("HOME SESSION ERROR:", error);

  const statusBox = document.getElementById("auth-status");

  if (session) {
    statusBox.textContent = `Logged in as ${session.user.email}`;
  } else {
    statusBox.textContent = "Not logged in";
    console.log("NO SESSION — staying on home.html");
  }
}

showAuthStatus();

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

async function toggleClaim(button, caseId) {
  // Check current state
  const isClaimed = button.dataset.claimed === "true";

  if (isClaimed) {
    // Unclaim action
    console.log(`Case ${caseId} unclaimed (dummy).`);
    alert(`Case ${caseId} has been unclaimed!`);

    // Update button text/state
    button.innerText = "Claim";
    button.dataset.claimed = "false";
  } else {
    // Claim action
    console.log(`Case ${caseId} claimed (dummy).`);
    alert(`Case ${caseId} has been claimed!`);

    // Update button text/state
    button.innerText = "Unclaim";
    button.dataset.claimed = "true";
  }
}

async function togglePain(button, caseId) {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    console.error("No authenticated user");
    return;
  }

  const res = await fetch(
    `http://localhost:4000/api/cases/${caseId}/pain`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        user_id: user.id   // ✅ REAL USER ID
      })
    }
  );

  const data = await res.json();

  console.log("Pain response:", data);

  button.innerText = 
    data.state === "pained" ? "Unpain" : "Pain";

  button.dataset.pained = data.state === "pained";
}

async function addSolve(caseId) {
  const solveText = prompt("Enter your solution:");

  if (!solveText) return;

  try {
    const res = await fetch(
      `/api/cases/${caseId}/solve`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          user_id: "your-user-uuid",
          solve_text: solveText
        })
      }
    );

    if (!res.ok) throw new Error("Solve request failed");

    const data = await res.json();

    console.log("Solve submitted:", data);

    // IMPORTANT: refresh system state
    await loadCases();
    await renderMatrix?.();

  } catch (err) {
    console.error("Solve error:", err);
  }
}

async function loadCases() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    console.error("No authenticated user");
    return;
  }

  const response = await fetch(`http://localhost:4000/api/cases?user_id=${user.id}`);
  const cases = await response.json();

  const container = document.getElementById("cases");

  if (!cases || cases.length === 0) {
    container.innerHTML = `<p>No cases available yet.</p>`;
    return;
  }

  // Clear container before re-rendering
  container.innerHTML = "";

  cases.forEach(c => {
    // Create card element
    const card = document.createElement("div");
    card.className = `
      rounded p-4 transition text-white
      ${c.lifecycle_state === "green"
        ? "bg-[#123832] border border-[#43e2d2]/50"
        : c.lifecycle_state === "orange"
          ? "bg-[#4a2f1f] border border-[#ffb779]/50"
          : "bg-[#201a16] border border-[#534438]/40"}
    `;

    // Render card
    card.innerHTML = `
      <h2 class="text-xl font-bold">${c.topic}</h2>
      <p class="text-[#e5e2e1]/75">${c.summary}</p>
      <p class="text-sm text-[#e5e2e1]/50">Subreddits: ${c.subreddits.join(", ")}</p>

      <div class="flex space-x-2 mt-3 action-buttons">
        <button class="claim bg-[#cd7f32] text-[#13100d] font-semibold px-3 py-1 rounded">
          ${c.claimed_by ? "Unclaim" : "Claim"}
        </button>
        <button class="pain bg-[#2a2a2a] text-[#ffb779] px-3 py-1 rounded">
          ${c.user_pained ? "Unpain" : "Pain"}
        </button>
        <button class="solve bg-[#43e2d2] text-[#13100d] font-semibold px-3 py-1 rounded">Solve</button>
      </div>
    `;

    // Card click → go to details
    card.addEventListener("click", () => {
      window.location.href = `http://localhost:3000/frontend/caseDetail?id=${c.id}`;
    });

    // Prevent the action-buttons area from triggering card redirect
    card.querySelector(".action-buttons").addEventListener("click", e => {
      e.stopPropagation(); // ✅ stops the card click
    });

    card.querySelector(".claim").addEventListener("click", async function (e) {
      e.stopPropagation();

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        alert("You must be logged in.");
        return;
      }

      try {
        const res = await fetch(
          `http://localhost:4000/api/cases/${c.id}/toggle-claim`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              user_id: user.id
            })
          }
        );

        if (!res.ok) {
          throw new Error(`Failed: ${res.status}`);
        }

        const data = await res.json();

        console.log("Toggle claim result:", data);

        // ✅ Toggle button text
        this.textContent =
          data.state === "claimed"
            ? "Unclaim"
            : "Claim";

        // optional color toggle
        this.className =
          data.state === "claimed"
            ? "claim bg-[#2a2a2a] text-[#ffb779] px-3 py-1 rounded"
            : "claim bg-[#cd7f32] text-[#13100d] font-semibold px-3 py-1 rounded";

        // refresh case feed if needed
        loadCases();

      } catch (err) {
        console.error("Claim toggle error:", err);
      }
    });

    card.querySelector(".pain").addEventListener("click", function () {
      togglePain(this, c.id);
    });
    card.querySelector(".solve").addEventListener("click", () => addSolve(c.id));

    // Append card to container
    container.appendChild(card);
  });
}

async function initHome() {
  await loadPreCases();
  await loadCases();
}

initHome();
*/
