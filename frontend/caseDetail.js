import { supabase } from '../database/supabase.js'

const { data: { user } } = await supabase.auth.getUser();

const params = new URLSearchParams(window.location.search);
let caseId = params.get("id");

if (!caseId || caseId === "null") {
  document.getElementById("case-details").innerHTML =
    "<p>No valid case ID provided.</p>";
  throw new Error("Invalid caseId");
}

document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("case-details");

  if (!container) return;

  const params = new URLSearchParams(window.location.search);
  const caseId = params.get("id");

  if (!caseId) {
    container.innerHTML = `<p>No valid case ID provided.</p>`;
    return;
  }

  loadCaseDetails(caseId);
});

async function loadCaseDetails(caseId) {
  try {
    const response = await fetch(`http://localhost:4000/api/cases/${caseId}`);
    const c = await response.json();

    console.log("Case details response:", c);
    console.log("Solutions from backend:", c.solves);

    const container = document.getElementById("case-details");
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
              .map(link => `<li><a href="${link}" target="_blank">${link}</a></li>`)
              .join("")}
          </ul>
        </div>

        <div class="section-card">
          <h2 class="section-heading">Actions</h2>
          <div class="button-row">
            <button class="button button--accent">Claim</button>
            <button class="button button--secondary">Unclaim</button>
            <button class="button button--secondary">Pain</button>
          </div>
        </div>

        <div class="section-card">
          <h2 class="section-heading">Solutions</h2>
          <ul class="solutions-list">
            ${(c.solves || [])
              .map(s => `
                <li class="solution-card ${s.accepted ? "solution-card--accepted" : ""}">
                  <p>${s.solve_text}</p>
                  <p class="solution-meta">By ${s.user_id}</p>

                  ${canManageSolutions
                    ? s.accepted
                      ? `<button class="button button--secondary unaccept-solution" data-solve-id="${s.id}">Un-accept</button>`
                      : `<button class="button button--primary accept-solution" data-solve-id="${s.id}">Accept</button>`
                    : s.accepted
                      ? `<p class="solution-status">Accepted solution</p>`
                      : `<p class="solution-meta">Only the claimant can accept this solution.</p>`
                  }
                </li>
              `)
              .join("")}
          </ul>
          <textarea id="solution-text" class="solution-input" placeholder="Propose a solution..."></textarea>
          <button id="submit-solution" class="button button--primary" style="margin-top: 16px;">Submit Solution</button>
        </div>
      </div>
    `;
    document.getElementById("submit-solution").addEventListener("click", () => {
      submitSolution(caseId);
    });
    document.querySelectorAll(".accept-solution").forEach(button => {
      button.addEventListener("click", () => {
        acceptSolution(button.dataset.solveId, caseId);
      });
    });
    document.querySelectorAll(".unaccept-solution").forEach(button => {
      button.addEventListener("click", () => {
        unacceptSolution(button.dataset.solveId, caseId);
      });
    });
  } catch (err) {
    console.error("Error loading case details:", err);
  }
}

loadCaseDetails(caseId);

async function submitSolution(caseId) {
  const textarea = document.getElementById("solution-text");
  const solveText = textarea.value.trim();

  if (!solveText) {
    alert("Please enter a solution first.");
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    alert("You must be logged in to submit a solution.");
    return;
  }

  const res = await fetch(`http://localhost:4000/api/cases/${caseId}/solve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      user_id: user.id,
      solve_text: solveText
    })
  });

  const data = await res.json();
  console.log("Submit solution response:", data);

  textarea.value = "";
  await loadCaseDetails(caseId);
}

async function acceptSolution(solveId, caseId) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    alert("You must be logged in to accept a solution.");
    return;
  }

  const res = await fetch(`http://localhost:4000/api/solves/${solveId}/accept`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      user_id: user.id
    })
  });

  const data = await res.json();
  console.log("Accept solution response:", data);

  if (!res.ok) {
    alert(data.error || "Could not accept solution.");
    return;
  }

  await loadCaseDetails(caseId);
}

async function unacceptSolution(solveId, caseId) {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    alert("You must be logged in to unaccept a solution.");
    return;
  }

  const res = await fetch(`http://localhost:4000/api/solves/${solveId}/unaccept`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      user_id: user.id
    })
  });

  const data = await res.json();
  console.log("Unaccept solution response:", data);

  if (!res.ok) {
    alert(data.error || "Could not unaccept solution.");
    return;
  }

  await loadCaseDetails(caseId);
}

