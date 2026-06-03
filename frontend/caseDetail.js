import { supabase } from "./supabaseClient.js";
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
    const canManage = user && c.claimed_by === user.id;
    const isPending = c.status === "pending";

    container.innerHTML = `
      <div class="case-card">
        <div class="case-card__header">
          <h1 class="case-title">${c.topic}</h1>
          <p class="case-summary">${c.summary}</p>
          <p class="case-meta">${c.mode || ""} · ${c.domain} · Gap ${c.gap_score} · ${(c.matrix_quadrant || "").replace(/_/g, " ")}</p>
          ${c.disclaimer ? `<p class="text-sm" style="color:#43e2d2;margin-top:12px;">${c.disclaimer}</p>` : ""}
          ${isPending ? `<p class="stat-note">Pending validation: ${c.confirmation_count}/${c.confirmations_required} (${c.publish_progress}%)</p>` : ""}
        </div>

        <div class="stats-grid">
          <div class="stat-card"><strong>Pain</strong><span class="stat-value">${c.pain_count}</span></div>
          <div class="stat-card"><strong>Solves</strong><span class="stat-value">${c.solve_count}</span></div>
          <div class="stat-card"><strong>Lifecycle</strong><span class="stat-value">${c.lifecycle_state}</span></div>
          <div class="stat-card"><strong>Source</strong><span class="stat-value" style="font-size:1rem;">${c.source || "—"}</span></div>
        </div>

        ${c.cta_text ? `<p class="stat-note" style="color:#ffb779;">${c.cta_text}</p>` : ""}

        <div class="section-card">
          <h2 class="section-heading">Posts</h2>
          <ul class="posts-list">
            ${(c.permalinks || []).map((link) => `<li><a href="${link}" target="_blank" rel="noopener">${link}</a></li>`).join("") || "<li>No links</li>"}
          </ul>
        </div>

        <div class="section-card">
          <h2 class="section-heading">Actions</h2>
          <div class="button-row">
            ${isPending && user ? `<button type="button" id="validate-case" class="button button--primary">Validate this case</button>` : ""}
            ${c.status === "published" && user ? `<button type="button" id="toggle-claim" class="button button--accent">${c.claimed_by === user.id ? "Unclaim" : "Claim"}</button>` : ""}
            ${canManage ? `<button type="button" id="mark-solved" class="button button--secondary">Mark solved</button>` : ""}
          </div>
        </div>

        <div class="section-card">
          <h2 class="section-heading">Solutions</h2>
          <ul class="solutions-list">
            ${(c.solves || [])
              .map(
                (s) => `
              <li class="solution-card ${s.accepted ? "solution-card--accepted" : ""}">
                <p>${s.solve_text}</p>
                <p class="solution-meta">By ${s.user_id?.slice(0, 8) || "anon"}…</p>
                ${
                  canManage
                    ? s.accepted
                      ? `<button type="button" class="button button--secondary unaccept-solution" data-solve-id="${s.id}">Un-accept</button>`
                      : `<button type="button" class="button button--primary accept-solution" data-solve-id="${s.id}">Accept</button>`
                    : ""
                }
              </li>`
              )
              .join("") || "<li>No solutions yet.</li>"}
          </ul>
          <textarea id="solution-text" class="solution-input" placeholder="Propose a solution..."></textarea>
          <button type="button" id="submit-solution" class="button button--primary" style="margin-top:16px;">Submit Solution</button>
        </div>
      </div>
    `;

    document.getElementById("submit-solution")?.addEventListener("click", () => submitSolution(id));
    document.querySelectorAll(".accept-solution").forEach((b) =>
      b.addEventListener("click", () => acceptSolution(b.dataset.solveId, id))
    );
    document.querySelectorAll(".unaccept-solution").forEach((b) =>
      b.addEventListener("click", () => unacceptSolution(b.dataset.solveId, id))
    );
    document.getElementById("validate-case")?.addEventListener("click", async () => {
      await apiFetch(`/cases/${id}/confirm`, { method: "POST", body: "{}" });
      loadCaseDetails(id);
    });
    document.getElementById("toggle-claim")?.addEventListener("click", async () => {
      await apiFetch(`/cases/${id}/toggle-claim`, { method: "POST", body: "{}" });
      loadCaseDetails(id);
    });
    document.getElementById("mark-solved")?.addEventListener("click", async () => {
      const note = prompt("Outcome note (optional):");
      const url = prompt("Outcome URL (optional):");
      await apiFetch(`/cases/${id}/solved`, {
        method: "POST",
        body: JSON.stringify({ outcome_note: note, outcome_url: url }),
      });
      loadCaseDetails(id);
    });
  } catch (err) {
    container.innerHTML = `<p>Could not load case: ${err.message}</p>`;
  }
}

async function submitSolution(id) {
  const solveText = document.getElementById("solution-text").value.trim();
  if (!solveText) return alert("Enter a solution first.");
  await apiFetch(`/cases/${id}/solve`, {
    method: "POST",
    body: JSON.stringify({ solve_text: solveText }),
  });
  loadCaseDetails(id);
}

async function acceptSolution(solveId, caseId) {
  try {
    await apiFetch(`/solves/${solveId}/accept`, { method: "POST", body: "{}" });
    loadCaseDetails(caseId);
  } catch (err) {
    alert(err.message);
  }
}

async function unacceptSolution(solveId, caseId) {
  try {
    await apiFetch(`/solves/${solveId}/unaccept`, { method: "POST", body: "{}" });
    loadCaseDetails(caseId);
  } catch (err) {
    alert(err.message);
  }
}
