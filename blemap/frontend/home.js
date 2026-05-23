import { supabase } from '../database/supabase.js'
import { signOut } from '../database/signOut.js'
import { getCurrentUserProfile } from '../database/getUserProfile.js'

let hasLoaded = false;

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

  // Optionally refresh your case list
  // loadCases();
}

/*
async function claimCase(caseId) {
  try {
    // Get the current user from Supabase Auth
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      alert("You must be logged in to claim a case.");
      return;
    }

    const res = await fetch(`http://localhost:4000/api/cases/${caseId}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: user.id }) // replace with actual UUID
    });

    if (!res.ok) {
      throw new Error(`Failed to claim case ${caseId}: ${res.statusText}`);
    }

    const data = await res.json();
    console.log("Claimed:", data);

    loadCases();
  } catch (err) {
    console.error("Error claiming case:", err);
    alert("Could not claim case. Please try again.");
  }
}*/

async function togglePain(button, caseId) {
  const hasPain = button.dataset.pained === "true";

  if (hasPain) {
    // Remove pain
    console.log(`Pain removed for case ${caseId} (dummy).`);
    button.innerText = "Pain";
    button.dataset.pained = "false";
  } else {
    // Add pain
    console.log(`Pain added for case ${caseId} (dummy).`);
    button.innerText = "Unpain";
    button.dataset.pained = "true";
  }

  // Optionally refresh case list
  // loadCases();
}


async function addSolve(caseId) {
  const solveText = prompt("Enter your solution:");
  const res = await fetch(`/api/cases/${caseId}/solve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: "your-user-uuid", solve_text: solveText })
  });
  const data = await res.json();
  console.log("Solve submitted:", data);
  loadCases();
}

async function loadCases() {
  const response = await fetch("http://localhost:4000/api/cases");
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
      shadow rounded p-4 transition
      ${c.lifecycle_state === "orange"
        ? "bg-orange-200 border border-orange-400"
        : c.lifecycle_state === "grey"
          ? "bg-white"
          : "bg-white"}
    `;

    // Render card
    card.innerHTML = `
      <h2 class="text-xl font-bold">${c.topic}</h2>
      <p class="text-gray-700">${c.summary}</p>
      <p class="text-sm text-gray-500">Subreddits: ${c.subreddits.join(", ")}</p>

      <div class="flex space-x-2 mt-3 action-buttons">
        <button class="claim bg-orange-500 text-white px-3 py-1 rounded">
          ${c.claimed_by ? "Unclaim" : "Claim"}
        </button>
        <button class="pain bg-red-500 text-white px-3 py-1 rounded">Pain</button>
        <button class="solve bg-green-500 text-white px-3 py-1 rounded">Solve</button>
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
            ? "claim bg-gray-500 text-white px-3 py-1 rounded"
            : "claim bg-orange-500 text-white px-3 py-1 rounded";

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