import { supabase } from "../database/supabase.js";
import { apiFetch } from "./api.js";

const params = new URLSearchParams(window.location.search);
const caseId = params.get("id");

if (!caseId || caseId === "null") {
  document.getElementById("case-details").innerHTML =
    "<p>No valid case ID provided.</p>";
} else {
  loadCaseDetails(caseId);
}

async function loadCaseDetails(id) {
  const container = document.getElementById("case-details");
  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    const c = await apiFetch(`/cases/${id}`);
    const canManageSolutions = user && c.claimed_by === user.id;

    container.innerHTML = `
      <div class="case-card">
        <div class="case-card__header">
          <h1 class="case-title">${c.topic}</h1>
          <p class="case-summary">${c.summary}</p>
          <p class="case-meta">Mode: ${c.mode || ""}</p>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <strong>Pain</strong>
            <span class="stat-value">${c.pain_count}</span>
          </div>
          <div class="stat-card">
            <strong>Solves</strong>
            <span class="stat-value">${c.solve_count}</span>
          </div>
          <div class="stat-card">
            <strong>Claimed By</strong>
            <span class="stat-value">${c.claimed_by || "None"}</span>
          </div>
          <div class="stat-card">
            <strong>Status</strong>
            <span class="stat-value">${c.lifecycle_state}</span>
          </div>
        </div>

        <div class="section-card">
          <h2 class="section-heading">Posts</h2>
          <ul class="posts-list">
            ${(c.permalinks || [])
              .map(
                (link) =>
                  `<li><a href="${link}" target="_blank" rel="noopener">${link}</a></li>`
              )
              .join("") || "<li>No linked posts yet.</li>"}
          </ul>
        </div>

        <div class="section-card">
          <h2 class="section-heading">Solutions</h2>
          <ul class="solutions-list">
            ${(c.solves || [])
              .map(
                (s) => `
                <li class="solution-card ${s.accepted ? "solution-card--accepted" : ""}">
                  <p>${s.solve_text}</p>
                  <p class="solution-meta">By ${s.user_id}</p>
                  ${
                    canManageSolutions
                      ? s.accepted
                        ? `<button type="button" class="button button--secondary unaccept-solution" data-solve-id="${s.id}">Un-accept</button>`
                        : `<button type="button" class="button button--primary accept-solution" data-solve-id="${s.id}">Accept</button>`
                      : s.accepted
                        ? `<p class="solution-status">Accepted solution</p>`
                        : `<p class="solution-meta">Only the claimant can accept this solution.</p>`
                  }
                </li>
              `
              )
              .join("") || "<li>No solutions yet.</li>"}
          </ul>
          <textarea id="solution-text" class="solution-input" placeholder="Propose a solution..."></textarea>
          <button type="button" id="submit-solution" class="button button--primary" style="margin-top: 16px;">Submit Solution</button>
        </div>
      </div>
    `;

    document.getElementById("submit-solution").addEventListener("click", () => {
      submitSolution(id);
    });
    document.querySelectorAll(".accept-solution").forEach((button) => {
      button.addEventListener("click", () => {
        acceptSolution(button.dataset.solveId, id);
      });
    });
    document.querySelectorAll(".unaccept-solution").forEach((button) => {
      button.addEventListener("click", () => {
        unacceptSolution(button.dataset.solveId, id);
      });
    });
  } catch (err) {
    console.error("Error loading case details:", err);
    container.innerHTML = `<p>Could not load case.</p>`;
  }
}

async function submitSolution(id) {
  const textarea = document.getElementById("solution-text");
  const solveText = textarea.value.trim();
  if (!solveText) {
    alert("Please enter a solution first.");
    return;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    alert("You must be logged in to submit a solution.");
    return;
  }

  await apiFetch(`/cases/${id}/solve`, {
    method: "POST",
    body: JSON.stringify({ user_id: user.id, solve_text: solveText }),
  });

  textarea.value = "";
  await loadCaseDetails(id);
}

async function acceptSolution(solveId, caseId) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    alert("You must be logged in.");
    return;
  }

  try {
    await apiFetch(`/solves/${solveId}/accept`, {
      method: "POST",
      body: JSON.stringify({ user_id: user.id }),
    });
    await loadCaseDetails(caseId);
  } catch (err) {
    alert(err.message);
  }
}

async function unacceptSolution(solveId, caseId) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    alert("You must be logged in.");
    return;
  }

  try {
    await apiFetch(`/solves/${solveId}/unaccept`, {
      method: "POST",
      body: JSON.stringify({ user_id: user.id }),
    });
    await loadCaseDetails(caseId);
  } catch (err) {
    alert(err.message);
  }
}
