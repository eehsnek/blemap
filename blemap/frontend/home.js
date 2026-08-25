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
  try {
    const response = await fetch(
      "http://localhost:4000/api/precases"
    );

    if (!response.ok) {
      throw new Error(`Failed to load precases: ${response.status}`);
    }

    const precases = await response.json();

    console.log("PRECASES:", precases);

    document.getElementById("reddit-feed").innerHTML =
      precases
        .map(post => `
          <li>
            <a
              href="https://reddit.com${post.permalink}"
              target="_blank"
            >
              ${post.title}
            </a>
          </li>
        `)
        .join("");

  } catch (err) {
    console.error("Load precases error:", err);
  }
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
  const container = document.getElementById("cases");

  if (!container) {
    console.error("Cases container not found.");
    return;
  }

  try {
    // 1. Get authenticated user
    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError) {
      throw userError;
    }

    if (!user) {
      console.error("No authenticated user.");
      container.innerHTML = `<p>Please log in to view cases.</p>`;
      return;
    }

    // 2. Fetch cases from backend
    const response = await fetch(
      `http://localhost:4000/api/cases?user_id=${encodeURIComponent(user.id)}`
    );

    if (!response.ok) {
      throw new Error(`Failed to load cases: ${response.status}`);
    }

    const cases = await response.json();

    console.log("Cases loaded:", cases);

    // 3. Handle empty catalogue
    if (!Array.isArray(cases) || cases.length === 0) {
      container.innerHTML = `<p>No cases available yet.</p>`;
      return;
    }

    // 4. Clear existing cards
    container.innerHTML = "";

    // 5. Render each case
    cases.forEach((c) => {
      const card = document.createElement("div");

      const lifecycleClass =
        c.lifecycle_state === "green"
          ? "bg-[#123832] border border-[#43e2d2]/50"
          : c.lifecycle_state === "orange"
            ? "bg-[#4a2f1f] border border-[#ffb779]/50"
            : "bg-[#201a16] border border-[#534438]/40";

      card.className = `
        rounded p-4 transition text-white
        ${lifecycleClass}
      `;

      card.innerHTML = `
        <h2 class="text-xl font-bold">
          ${c.topic ?? "Untitled Case"}
        </h2>

        <p class="text-[#e5e2e1]/75">
          ${c.summary ?? ""}
        </p>

        <p class="text-sm text-[#e5e2e1]/50">
          Subreddits:
          ${(c.subreddits ?? []).join(", ") || "None"}
        </p>

        <div class="flex space-x-2 mt-3 action-buttons">

          <button
            class="claim bg-[#cd7f32] text-[#13100d] font-semibold px-3 py-1 rounded"
          >
            ${c.claimed_by ? "Unclaim" : "Claim"}
          </button>

          <button
            class="pain bg-[#2a2a2a] text-[#ffb779] px-3 py-1 rounded"
          >
            ${c.user_pained ? "Unpain" : "Pain"}
          </button>

          <button
            class="solve bg-[#43e2d2] text-[#13100d] font-semibold px-3 py-1 rounded"
          >
            Solve
          </button>

        </div>
      `;

      // --------------------------------
      // CARD → CASE DETAILS
      // --------------------------------

      card.addEventListener("click", () => {
        window.location.href =
          `/frontend/caseDetail.html?id=${c.id}`;
      });

      // --------------------------------
      // ACTION BUTTONS
      // --------------------------------

      const actionButtons =
        card.querySelector(".action-buttons");

      actionButtons.addEventListener("click", (event) => {
        event.stopPropagation();
      });

      // --------------------------------
      // CLAIM
      // --------------------------------

      const claimButton =
        card.querySelector(".claim");

      claimButton.addEventListener("click", async () => {
        try {
          const response = await fetch(
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

          if (!response.ok) {
            throw new Error(
              `Claim request failed: ${response.status}`
            );
          }

          const result = await response.json();

          console.log("Toggle claim result:", result);

          // Reload catalogue so lifecycle state,
          // claimed_by, and button text stay synchronized.
          await loadCases();

        } catch (err) {
          console.error("Claim toggle error:", err);
        }
      });

      // --------------------------------
      // PAIN
      // --------------------------------

      const painButton =
        card.querySelector(".pain");

      painButton.addEventListener("click", () => {
        togglePain(painButton, c.id);
      });

      // --------------------------------
      // SOLVE
      // --------------------------------

      const solveButton =
        card.querySelector(".solve");

      solveButton.addEventListener("click", () => {
        addSolve(c.id);
      });

      // --------------------------------
      // APPEND
      // --------------------------------

      container.appendChild(card);
    });

  } catch (err) {
    console.error("Load cases error:", err);

    container.innerHTML = `
      <p class="text-[#ffb779]">
        Unable to load cases.
      </p>
    `;
  }
}

async function initHome() {
  await loadPreCases();
  await loadCases();
}

initHome();
