import { supabase } from "../supabaseClient.js";
import { apiFetch } from "../api.js";
import { navigate } from "../router.js";
import { escapeHtml } from "../util.js";

export async function mount(container, params) {
  const caseId = params?.id;
  if (!caseId) {
    container.innerHTML = `<p class="text-[#ffb779]">No case selected. <button type="button" class="underline" id="back-home">Back to Home</button></p>`;
    document.getElementById("back-home")?.addEventListener("click", () => navigate("home"));
    return () => {};
  }

  container.innerHTML = `
    <div class="max-w-3xl">
      <button type="button" id="back-btn" class="mb-6 text-[#ffb779] hover:text-[#ffd1aa] text-sm font-semibold">← Back</button>
      <div id="case-details"><p class="text-[#e5e2e1]/60">Loading…</p></div>
    </div>
  `;

  document.getElementById("back-btn").addEventListener("click", () => navigate("home"));
  await loadCaseDetails(caseId);

  return () => {};
}

async function loadCaseDetails(id) {
  const container = document.getElementById("case-details");
  const { data: { user } } = await supabase.auth.getUser();

  try {
    const c = await apiFetch(`/cases/${id}`);
    const canManage = user && c.claimed_by === user.id;
    const isPending = c.status === "pending";

    container.innerHTML = `
      <div class="case-panel rounded-2xl p-6 border border-[#534438]/30 bg-[#201a16]">
        <h1 class="text-2xl font-bold text-[#ffb779] mb-2">${escapeHtml(c.topic)}</h1>
        <p class="text-[#e5e2e1]/80 mb-4">${escapeHtml(c.summary)}</p>
        <p class="text-sm text-[#43e2d2] mb-4">${escapeHtml(c.domain)} · Gap ${c.gap_score} · ${escapeHtml((c.matrix_quadrant || "").replace(/_/g, " "))}</p>
        ${c.disclaimer ? `<p class="text-sm text-[#43e2d2]/80 mb-4 border-l-2 border-[#43e2d2]/40 pl-3">${escapeHtml(c.disclaimer)}</p>` : ""}
        ${isPending ? `<p class="text-sm text-[#e5e2e1]/50 mb-4">Pending: ${c.confirmation_count}/${c.confirmations_required} validations</p>` : ""}

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div class="stat-box"><span class="text-xs text-[#e5e2e1]/50">Pain</span><p class="text-xl font-bold text-[#ffb779]">${c.pain_count}</p></div>
          <div class="stat-box"><span class="text-xs text-[#e5e2e1]/50">Solves</span><p class="text-xl font-bold">${c.solve_count}</p></div>
          <div class="stat-box"><span class="text-xs text-[#e5e2e1]/50">Status</span><p class="text-lg">${escapeHtml(c.lifecycle_state)}</p></div>
          <div class="stat-box"><span class="text-xs text-[#e5e2e1]/50">Source</span><p class="text-lg">${escapeHtml(c.source || "—")}</p></div>
        </div>

        <div class="flex flex-wrap gap-2 mb-8">
          ${isPending && user && !c.user_confirmed ? `<button type="button" id="validate-case" class="btn-primary">Validate</button>` : ""}
          ${c.status === "published" && user ? `<button type="button" id="toggle-claim" class="btn-primary">${c.claimed_by === user.id ? "Unclaim" : "Claim"}</button>` : ""}
          ${canManage ? `<button type="button" id="mark-solved" class="btn-secondary">Mark solved</button>` : ""}
        </div>

        <h2 class="text-lg font-semibold mb-3">Solutions</h2>
        <ul class="space-y-3 mb-4" id="solutions-list">
          ${(c.solves || []).map((s) => `
            <li class="p-4 rounded-xl bg-[#13100d] border ${s.accepted ? "border-[#ffb779]/40" : "border-[#534438]/30"}">
              <p>${escapeHtml(s.solve_text)}</p>
              ${canManage ? (s.accepted
                ? `<button type="button" class="btn-secondary mt-2 unaccept-solution" data-sid="${s.id}">Un-accept</button>`
                : `<button type="button" class="btn-primary mt-2 accept-solution" data-sid="${s.id}">Accept</button>`) : ""}
            </li>`).join("") || '<li class="text-[#e5e2e1]/50">No solutions yet.</li>'}
        </ul>
        <textarea id="solution-text" rows="3" class="w-full bg-[#13100d] border border-[#534438]/40 rounded px-3 py-2 text-white mb-2" placeholder="Propose a solution…"></textarea>
        <button type="button" id="submit-solution" class="btn-primary">Submit solution</button>
      </div>
    `;

    bindCaseActions(id, user);
  } catch (err) {
    container.innerHTML = `<p class="text-[#ffb779]">${escapeHtml(err.message)}</p>`;
  }
}

function bindCaseActions(id, user) {
  document.getElementById("submit-solution")?.addEventListener("click", async () => {
    const text = document.getElementById("solution-text").value.trim();
    if (!text) return alert("Enter a solution.");
    try {
      await apiFetch(`/cases/${id}/solve`, {
        method: "POST",
        body: JSON.stringify({ solve_text: text }),
      });
      await loadCaseDetails(id);
    } catch (err) {
      alert(err.message);
    }
  });

  document.querySelectorAll(".accept-solution").forEach((b) =>
    b.addEventListener("click", async () => {
      try {
        await apiFetch(`/solves/${b.dataset.sid}/accept`, { method: "POST", body: "{}" });
        await loadCaseDetails(id);
      } catch (err) {
        alert(err.message);
      }
    })
  );

  document.querySelectorAll(".unaccept-solution").forEach((b) =>
    b.addEventListener("click", async () => {
      try {
        await apiFetch(`/solves/${b.dataset.sid}/unaccept`, { method: "POST", body: "{}" });
        await loadCaseDetails(id);
      } catch (err) {
        alert(err.message);
      }
    })
  );

  document.getElementById("validate-case")?.addEventListener("click", async () => {
    try {
      await apiFetch(`/cases/${id}/confirm`, { method: "POST", body: "{}" });
      await loadCaseDetails(id);
    } catch (err) {
      alert(err.message);
    }
  });

  document.getElementById("toggle-claim")?.addEventListener("click", async () => {
    try {
      await apiFetch(`/cases/${id}/toggle-claim`, { method: "POST", body: "{}" });
      await loadCaseDetails(id);
    } catch (err) {
      alert(err.message);
    }
  });

  document.getElementById("mark-solved")?.addEventListener("click", async () => {
    const note = prompt("Outcome note (optional):");
    const url = prompt("Outcome URL (optional):");
    try {
      await apiFetch(`/cases/${id}/solved`, {
        method: "POST",
        body: JSON.stringify({ outcome_note: note, outcome_url: url }),
      });
      await loadCaseDetails(id);
    } catch (err) {
      alert(err.message);
    }
  });
}
