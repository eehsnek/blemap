import { supabase } from "../supabaseClient.js";
import { apiFetch } from "../api.js";
import { navigate } from "../router.js";
import { escapeHtml } from "../util.js";
import { emitDataChanged, onDataChanged, debounce } from "../lib/events.js";

let currentCaseId = null;

export async function mount(container, params) {
  const caseId = params?.id;
  currentCaseId = caseId;
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

  const unsub = onDataChanged(debounce(() => loadCaseDetails(caseId), 300));

  return () => unsub();
}

function workflowStep(c) {
  const hasAccepted = (c.solves || []).some((s) => s.accepted);
  const steps = [
    { id: "validate", label: "Validate", done: c.status !== "pending" || (c.confirmation_count ?? 0) > 0 },
    { id: "published", label: "Published", done: c.status === "published" },
    { id: "claim", label: "Claim", done: Boolean(c.claimed_by) },
    { id: "solve", label: "Propose solve", done: (c.solves || []).length > 0 },
    { id: "accept", label: "Accept", done: hasAccepted },
    { id: "resolved", label: "Green", done: c.lifecycle_state === "green" },
  ];
  let current = 0;
  if (c.status === "pending") current = 0;
  else if (!c.claimed_by) current = 2;
  else if (!hasAccepted && !(c.solves || []).length) current = 3;
  else if (!hasAccepted) current = 4;
  else if (c.lifecycle_state !== "green") current = 5;
  else current = 5;
  return { steps, current };
}

async function loadGapHistory(id, currentGap) {
  try {
    const events = await apiFetch(`/cases/${id}/events?limit=20`);
    const painEvents = events.filter((e) => e.event_type === "pain_added");
    if (!painEvents.length) return null;
    const first = painEvents[painEvents.length - 1];
    const oldGap = first.metadata?.gap_score;
    if (oldGap != null && oldGap !== currentGap) {
      return { was: oldGap, now: currentGap };
    }
  } catch {
    /* optional */
  }
  return null;
}

async function loadCaseDetails(id) {
  const container = document.getElementById("case-details");
  const { data: { user } } = await supabase.auth.getUser();

  try {
    const c = await apiFetch(`/cases/${id}`);
    const canManage = user && c.claimed_by === user.id;
    const isPending = c.status === "pending";
    const { steps, current } = workflowStep(c);
    const gapHistory = await loadGapHistory(id, c.gap_score);
    const mergeCount = Array.isArray(c.permalinks) ? c.permalinks.length : 0;
    const firstLink = mergeCount ? c.permalinks[0] : null;

    const related = await apiFetch(`/cases/${id}/related?limit=5`).catch(() => []);

    container.innerHTML = `
      <div class="case-panel rounded-2xl p-6 border border-[#534438]/30 bg-[#201a16]">
        <h1 class="text-2xl font-bold text-[#ffb779] mb-2">${escapeHtml(c.topic)}</h1>
        <p class="text-[#e5e2e1]/80 mb-4">${escapeHtml(c.summary)}</p>
        <p class="text-sm text-[#43e2d2] mb-2">${escapeHtml(c.domain)} · Gap ${c.gap_score} · ${escapeHtml((c.matrix_quadrant || "").replace(/_/g, " "))}</p>
        ${gapHistory ? `<p class="text-xs text-[#43e2d2]/70 mb-4">Gap was ${gapHistory.was} → now ${gapHistory.now}</p>` : ""}
        ${c.disclaimer ? `<p class="text-sm text-[#43e2d2]/80 mb-4 border-l-2 border-[#43e2d2]/40 pl-3">${escapeHtml(c.disclaimer)}</p>` : ""}
        ${mergeCount > 0 ? `<p class="text-sm text-[#e5e2e1]/60 mb-4">+${mergeCount} signal${mergeCount > 1 ? "s" : ""} merged${firstLink ? ` · <a href="${escapeHtml(firstLink)}" target="_blank" rel="noopener" class="text-[#43e2d2] underline">source</a>` : ""}</p>` : ""}
        ${
          Array.isArray(related) && related.length
            ? `<div class="mb-6">
          <h2 class="text-sm font-semibold text-[#ffb779] mb-2">Related cases</h2>
          <ul class="space-y-2">
            ${related
              .map(
                (r) => `<li>
              <button type="button" class="related-case text-left text-sm text-[#43e2d2] hover:underline" data-id="${escapeHtml(r.id)}">
                ${escapeHtml(r.topic || "Untitled")}
                <span class="text-[#e5e2e1]/50"> · ${(Number(r.similarity) * 100).toFixed(0)}% similar</span>
              </button>
            </li>`
              )
              .join("")}
          </ul>
        </div>`
            : ""
        }

        ${isPending ? `
          <div class="mb-4">
            <div class="progress-bar mb-1"><div class="progress-bar__fill" style="width:${c.publish_progress ?? 0}%"></div></div>
            <p class="text-sm text-[#e5e2e1]/50">Pending: ${c.confirmation_count}/${c.confirmations_required} validations</p>
          </div>` : ""}

        <div class="workflow-stepper mb-6">
          ${steps
            .map(
              (s, i) => `
            <span class="workflow-step ${s.done ? "workflow-step--done" : ""} ${i === current ? "workflow-step--current" : ""}">${escapeHtml(s.label)}</span>`
            )
            .join('<span class="workflow-step__sep">→</span>')}
        </div>

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
          ${c.claimed_by === user?.id && c.status === "published" ? `<button type="button" id="view-matrix" class="btn-ghost">View on Matrix</button>` : ""}
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
        <div id="solve-feedback" class="hidden mb-2 text-sm rounded-lg p-3 border border-[#534438]/40"></div>
        <textarea id="solution-text" rows="3" class="w-full bg-[#13100d] border border-[#534438]/40 rounded px-3 py-2 text-white mb-2" placeholder="Propose a solution…"></textarea>
        <button type="button" id="submit-solution" class="btn-primary">Submit solution</button>
      </div>
    `;

    bindCaseActions(id, user);
    wireSolveFeedback(id);
    container.querySelectorAll(".related-case").forEach((btn) => {
      btn.addEventListener("click", () => navigate("case", { id: btn.dataset.id }));
    });
  } catch (err) {
    container.innerHTML = `<p class="text-[#ffb779]">${escapeHtml(err.message)}</p>`;
  }
}

function wireSolveFeedback(id) {
  const textarea = document.getElementById("solution-text");
  const feedback = document.getElementById("solve-feedback");
  if (!textarea || !feedback) return;

  let debounceTimer;
  textarea.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const text = textarea.value.trim();
    if (text.length < 20) {
      feedback.classList.add("hidden");
      return;
    }
    debounceTimer = setTimeout(async () => {
      try {
        const { analysis } = await apiFetch(`/cases/${id}/solve/analyze`, {
          method: "POST",
          body: JSON.stringify({ solve_text: text }),
        });
        feedback.classList.remove("hidden");
        if (analysis.isRelevant) {
          feedback.className = "mb-2 text-sm rounded-lg p-3 border border-[#43e2d2]/40 bg-[#43e2d2]/10 text-[#43e2d2]";
          feedback.textContent = analysis.suggestion
            ? `AI: ${analysis.suggestion} (quality ${Math.round((analysis.qualityScore ?? 0) * 100)}%)`
            : `Looks relevant (quality ${Math.round((analysis.qualityScore ?? 0) * 100)}%)`;
        } else {
          feedback.className = "mb-2 text-sm rounded-lg p-3 border border-[#ffb779]/40 bg-[#ffb779]/10 text-[#ffb779]";
          feedback.textContent = analysis.rejectionMessage || "May not address this case.";
        }
      } catch {
        feedback.classList.add("hidden");
      }
    }, 500);
  });
}

function bindCaseActions(id, user) {
  document.getElementById("view-matrix")?.addEventListener("click", () => {
    emitDataChanged("claim");
    navigate("matrix");
  });

  document.getElementById("submit-solution")?.addEventListener("click", async () => {
    const text = document.getElementById("solution-text").value.trim();
    if (!text) return alert("Enter a solution.");
    try {
      await apiFetch(`/cases/${id}/solve`, {
        method: "POST",
        body: JSON.stringify({ solve_text: text }),
      });
      emitDataChanged("solve");
      await loadCaseDetails(id);
    } catch (err) {
      alert(err.message);
    }
  });

  document.querySelectorAll(".accept-solution").forEach((b) =>
    b.addEventListener("click", async () => {
      try {
        await apiFetch(`/solves/${b.dataset.sid}/accept`, { method: "POST", body: "{}" });
        emitDataChanged("solve_accept");
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
        emitDataChanged("solve_unaccept");
        await loadCaseDetails(id);
      } catch (err) {
        alert(err.message);
      }
    })
  );

  document.getElementById("validate-case")?.addEventListener("click", async () => {
    try {
      const r = await apiFetch(`/cases/${id}/confirm`, { method: "POST", body: "{}" });
      emitDataChanged("validate");
      if (r.published) {
        const el = document.getElementById("case-details");
        if (el) {
          const banner = document.createElement("p");
          banner.className = "text-[#43e2d2] font-semibold mb-4";
          banner.textContent = "Published to matrix!";
          el.prepend(banner);
        }
      }
      await loadCaseDetails(id);
    } catch (err) {
      alert(err.message);
    }
  });

  document.getElementById("toggle-claim")?.addEventListener("click", async () => {
    try {
      const r = await apiFetch(`/cases/${id}/toggle-claim`, { method: "POST", body: "{}" });
      emitDataChanged("claim");
      await loadCaseDetails(id);
      if (r.state === "claimed") {
        document.getElementById("view-matrix")?.scrollIntoView({ behavior: "smooth" });
      }
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
      emitDataChanged("solved");
      await loadCaseDetails(id);
    } catch (err) {
      alert(err.message);
    }
  });
}
