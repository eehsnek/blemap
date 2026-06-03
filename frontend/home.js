import { supabase } from "../database/supabase.js";
import { apiFetch } from "./api.js";
import { caseDetailUrl } from "./config.js";

async function showAuthStatus() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const statusBox = document.getElementById("auth-status");

  if (user) {
    statusBox.textContent = `Logged in as ${user.email}`;
  } else {
    statusBox.textContent = "Not logged in";
    window.location.href = "/frontend/index.html";
  }
}

showAuthStatus();

document.getElementById("signout-btn").addEventListener("click", async () => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    document.getElementById("message-box").textContent = error.message;
  } else {
    window.location.href = "/frontend/index.html";
  }
});

async function loadPreCases() {
  const feed = document.getElementById("reddit-feed");
  try {
    const json = await apiFetch("/test");
    feed.innerHTML = (json.inserted ?? [])
      .map(
        (post) =>
          `<li><a class="text-[#43e2d2] hover:text-[#7ff4ea]" href="https://reddit.com${post.permalink}" target="_blank" rel="noopener">${post.title}</a></li>`
      )
      .join("");
  } catch {
    feed.innerHTML = `<li class="text-[#e5e2e1]/50">Pre-case feed unavailable.</li>`;
  }
}

async function togglePain(button, caseId) {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return;

  try {
    const data = await apiFetch(`/cases/${caseId}/pain`, {
      method: "POST",
      body: JSON.stringify({ user_id: user.id }),
    });
    button.innerText = data.state === "pained" ? "Unpain" : "Pain";
    button.dataset.pained = data.state === "pained";
    loadCases();
  } catch (err) {
    console.error("Pain toggle error:", err);
  }
}

async function addSolve(caseId) {
  const solveText = prompt("Enter your solution:");
  if (!solveText) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    alert("You must be logged in.");
    return;
  }

  try {
    await apiFetch(`/cases/${caseId}/solve`, {
      method: "POST",
      body: JSON.stringify({ user_id: user.id, solve_text: solveText }),
    });
    await loadCases();
  } catch (err) {
    console.error("Solve error:", err);
    alert(err.message || "Could not submit solution.");
  }
}

async function loadCases() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  let cases = [];
  try {
    cases = await apiFetch(`/cases?user_id=${encodeURIComponent(user.id)}`);
  } catch (err) {
    console.error("Load cases error:", err);
  }

  const container = document.getElementById("cases");
  if (!cases.length) {
    container.innerHTML = `<p class="text-[#e5e2e1]/60">No cases available yet.</p>`;
    return;
  }

  container.innerHTML = "";

  cases.forEach((c) => {
    const card = document.createElement("div");
    card.className = `
      rounded p-4 transition text-white cursor-pointer
      ${
        c.lifecycle_state === "green"
          ? "bg-[#123832] border border-[#43e2d2]/50"
          : c.lifecycle_state === "orange"
            ? "bg-[#4a2f1f] border border-[#ffb779]/50"
            : "bg-[#201a16] border border-[#534438]/40"
      }
    `;

    const subreddits = Array.isArray(c.subreddits) ? c.subreddits.join(", ") : "";

    card.innerHTML = `
      <h2 class="text-xl font-bold">${c.topic}</h2>
      <p class="text-[#e5e2e1]/75">${c.summary}</p>
      <p class="text-sm text-[#e5e2e1]/50">Subreddits: ${subreddits || "—"}</p>
      <div class="flex space-x-2 mt-3 action-buttons">
        <button type="button" class="claim bg-[#cd7f32] text-[#13100d] font-semibold px-3 py-1 rounded">
          ${c.claimed_by ? "Unclaim" : "Claim"}
        </button>
        <button type="button" class="pain bg-[#2a2a2a] text-[#ffb779] px-3 py-1 rounded">
          ${c.user_pained ? "Unpain" : "Pain"}
        </button>
        <button type="button" class="solve bg-[#43e2d2] text-[#13100d] font-semibold px-3 py-1 rounded">Solve</button>
      </div>
    `;

    card.addEventListener("click", () => {
      window.location.href = caseDetailUrl(c.id);
    });

    card.querySelector(".action-buttons").addEventListener("click", (e) => {
      e.stopPropagation();
    });

    card.querySelector(".claim").addEventListener("click", async function (e) {
      e.stopPropagation();
      try {
        const data = await apiFetch(`/cases/${c.id}/toggle-claim`, {
          method: "POST",
          body: JSON.stringify({ user_id: user.id }),
        });
        this.textContent = data.state === "claimed" ? "Unclaim" : "Claim";
        this.className =
          data.state === "claimed"
            ? "claim bg-[#2a2a2a] text-[#ffb779] px-3 py-1 rounded"
            : "claim bg-[#cd7f32] text-[#13100d] font-semibold px-3 py-1 rounded";
        loadCases();
      } catch (err) {
        alert(err.message || "Claim failed.");
      }
    });

    card.querySelector(".pain").addEventListener("click", function (e) {
      e.stopPropagation();
      togglePain(this, c.id);
    });

    card.querySelector(".solve").addEventListener("click", (e) => {
      e.stopPropagation();
      addSolve(c.id);
    });

    container.appendChild(card);
  });
}

async function initHome() {
  await loadPreCases();
  await loadCases();
}

initHome();
