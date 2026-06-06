import { apiFetch } from "../api.js";
import { supabase } from "../supabaseClient.js";
import { navigate } from "../router.js";
import { escapeHtml } from "../util.js";
import { emitDataChanged } from "../lib/events.js";

const MIN_WORDS = 8;
const EXAMPLES = [
  "Young graduates in Manila wait over a year for entry-level roles because companies demand experience but offer few apprenticeships.",
  "My landlord withheld my deposit for two months without an itemized damage list despite a clean move-out inspection.",
];

let currentDraft = null;
let mode = "guided";

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function buildCombinedText() {
  const who = document.getElementById("field-who")?.value?.trim() ?? "";
  const what = document.getElementById("field-what")?.value?.trim() ?? "";
  const why = document.getElementById("field-why")?.value?.trim() ?? "";
  const free = document.getElementById("post-input")?.value?.trim() ?? "";

  if (mode === "freeform") return free;

  const parts = [];
  if (who) parts.push(who);
  if (what) parts.push(what);
  if (why) parts.push(`This matters because ${why}`);
  return parts.join(". ").replace(/\.\./g, ".").trim();
}

function hasWhoSignal(text) {
  return /\b(people|youth|young|workers|tenants|renters|users|customers|students|families|i |we |my )\b/i.test(
    text
  );
}

function hasWhatSignal(text) {
  return /\b(because|can't|cannot|won't|refuse|fail|lack|without|struggle|unfair|delay|charge|deny|lose)\b/i.test(
    text
  ) || text.includes(".");
}

function updateChecklist() {
  const text = buildCombinedText();
  const count = wordCount(text);
  const el = document.getElementById("submit-checklist");
  const btn = document.getElementById("analyze-btn");
  if (!el) return;

  const items = [
    { ok: count >= MIN_WORDS, label: `At least ${MIN_WORDS} words (${count}/${MIN_WORDS})` },
    { ok: hasWhoSignal(text), label: "Names who is affected" },
    { ok: hasWhatSignal(text), label: "Explains what goes wrong" },
  ];

  el.innerHTML = items
    .map(
      (item) => `
    <li class="submit-checklist__item ${item.ok ? "submit-checklist__item--ok" : ""}">
      <span class="submit-checklist__mark">${item.ok ? "✓" : "○"}</span>
      ${escapeHtml(item.label)}
    </li>`
    )
    .join("");

  if (btn) {
    btn.disabled = !text;
    btn.classList.toggle("opacity-60", !items.every((i) => i.ok));
    btn.title = text ? "" : "Add your problem description first";
  }
}

function setMode(next) {
  mode = next;
  document.getElementById("guided-panel")?.classList.toggle("hidden", mode !== "guided");
  document.getElementById("freeform-panel")?.classList.toggle("hidden", mode !== "freeform");
  document.getElementById("mode-guided")?.classList.toggle("submit-mode--active", mode === "guided");
  document.getElementById("mode-freeform")?.classList.toggle("submit-mode--active", mode === "freeform");
  updateChecklist();
}

function applyChipPrompt(chip) {
  const prompts = {
    "Who is affected?": "Young people in ",
    "What goes wrong in practice?": " struggle because ",
    "Why does it matter now?": " This matters because ",
    "Add scale (how many affected)": "Thousands of ",
    "Add root cause": " due to limited entry-level roles and ",
    "Add location or timeframe": " in the Philippines over the past year",
  };
  const insert = prompts[chip] ?? chip;

  if (mode === "guided") {
    const what = document.getElementById("field-what");
    if (what && !what.value.trim()) {
      what.value = insert.trim();
      what.focus();
    } else {
      const who = document.getElementById("field-who");
      if (who) {
        who.value = (who.value + " " + insert).trim();
        who.focus();
      }
    }
  } else {
    const input = document.getElementById("post-input");
    if (input) {
      input.value = (input.value + " " + insert).trim();
      input.focus();
    }
  }
  updateChecklist();
}

function renderRejection(draft) {
  const output = document.getElementById("case-details");
  const chips = (draft.suggestions ?? [])
    .map(
      (s) =>
        `<button type="button" class="submit-chip" data-chip="${escapeHtml(s)}">${escapeHtml(s)}</button>`
    )
    .join("");

  output.innerHTML = `
    <div class="submit-feedback submit-feedback--warn" id="rejection-card">
      <h2 class="submit-feedback__title">Needs more detail</h2>
      <p class="submit-feedback__body">${escapeHtml(draft.rejectionMessage)}</p>
      ${draft.wordCount != null ? `<p class="submit-feedback__meta">${draft.wordCount} of ${draft.wordsRequired ?? MIN_WORDS} words</p>` : ""}
      ${chips ? `<div class="submit-chips">${chips}</div>` : ""}
      ${
        draft.expandPrompt
          ? `
        <label class="submit-expand-label" for="expand-prompt">Suggested starter (edit and re-analyze)</label>
        <textarea id="expand-prompt" rows="3" class="submit-expand-input">${escapeHtml(draft.expandPrompt)}</textarea>
        <button type="button" id="use-expand-btn" class="btn-secondary mt-2 text-sm">Use this text</button>`
          : ""
      }
    </div>`;

  output.querySelectorAll(".submit-chip").forEach((btn) => {
    btn.addEventListener("click", () => applyChipPrompt(btn.dataset.chip));
  });

  document.getElementById("use-expand-btn")?.addEventListener("click", () => {
    const expanded = document.getElementById("expand-prompt")?.value?.trim();
    if (!expanded) return;
    if (mode === "freeform") {
      document.getElementById("post-input").value = expanded;
    } else {
      document.getElementById("field-what").value = expanded;
    }
    updateChecklist();
    document.getElementById("rejection-card")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
}

function renderSuccessPreview(draft) {
  const s = draft.structured;
  const dup = draft.isDuplicate;
  const painPct = Math.round((s.pain_level ?? 0.5) * 100);

  return `
    <div class="submit-feedback submit-feedback--ok space-y-3">
      <h2 class="submit-feedback__title text-[#ffb779]">Review before posting</h2>
      <p class="text-sm text-[#e5e2e1]/60">After you confirm, the case stays <strong class="text-[#43e2d2]">pending</strong> until the community validates it — then it appears on the Matrix.</p>
      ${s.disclaimer ? `<p class="text-sm text-[#43e2d2]">${escapeHtml(s.disclaimer)}</p>` : ""}
      ${dup ? `<p class="text-sm text-[#ffb779]">Looks similar to an existing case — confirming will merge your signal (+1 pain).</p>` : ""}
      <div class="submit-preview-card">
        <p class="text-xs uppercase tracking-wide text-[#43e2d2]/80 mb-1">Structured topic</p>
        <p class="font-bold text-lg text-[#ffb779]">${escapeHtml(s.topic)}</p>
        <p class="mt-2 text-[#e5e2e1]/85">${escapeHtml(s.summary)}</p>
        <div class="flex flex-wrap gap-2 mt-3 text-xs">
          <span class="metrics-pill">${escapeHtml(s.domain)}</span>
          <span class="metrics-pill">Pain ~${painPct}%</span>
          <span class="metrics-pill">${escapeHtml(s.category)}</span>
        </div>
      </div>
      <div class="flex gap-2 pt-2">
        <button type="button" id="confirm-btn" class="bg-[#cd7f32] text-[#13100d] font-semibold px-4 py-2 rounded">${dup ? "Confirm merge" : "Confirm & submit"}</button>
        <button type="button" id="cancel-btn" class="text-[#e5e2e1]/60 px-3">Cancel</button>
      </div>
    </div>`;
}

export function mount(container) {
  container.innerHTML = `
    <div class="max-w-2xl submit-page">
      <p class="text-sm uppercase tracking-wide text-[#43e2d2] mb-1">Submit</p>
      <h1 class="text-3xl font-bold mb-2 page-title--serif">Describe your problem</h1>
      <p class="text-[#e5e2e1]/70 mb-2">AI validates your words — you confirm before anything is saved.</p>
      <p class="text-sm text-[#e5e2e1]/50 mb-6">Good submissions name <strong class="text-[#e5e2e1]/70">who</strong> is affected, <strong class="text-[#e5e2e1]/70">what</strong> goes wrong, and <strong class="text-[#e5e2e1]/70">why</strong> it matters.</p>

      <details class="submit-examples mb-6">
        <summary class="submit-examples__summary">See example problems</summary>
        <ul class="submit-examples__list">
          ${EXAMPLES.map((ex) => `<li>${escapeHtml(ex)}</li>`).join("")}
        </ul>
      </details>

      <div class="submit-mode-toggle mb-4">
        <button type="button" id="mode-guided" class="submit-mode submit-mode--active">Guided</button>
        <button type="button" id="mode-freeform" class="submit-mode">Freeform</button>
      </div>

      <div id="guided-panel" class="submit-guided space-y-3 mb-4">
        <label class="submit-field">
          <span class="submit-field__label">Who is affected?</span>
          <input type="text" id="field-who" class="submit-field__input" placeholder="e.g. Young job seekers in the Philippines" />
        </label>
        <label class="submit-field">
          <span class="submit-field__label">What goes wrong?</span>
          <textarea id="field-what" rows="3" class="submit-field__input" placeholder="e.g. They can't find entry-level roles because companies demand experience but offer few apprenticeships"></textarea>
        </label>
        <label class="submit-field">
          <span class="submit-field__label">Why does it matter? <span class="text-[#e5e2e1]/40">(optional)</span></span>
          <input type="text" id="field-why" class="submit-field__input" placeholder="e.g. Unemployment among youth has risen for three years" />
        </label>
      </div>

      <div id="freeform-panel" class="hidden mb-4">
        <textarea id="post-input" rows="6"
          class="w-full min-h-[140px] bg-[#13100d] text-white px-4 py-3 rounded border border-[#534438]/40 focus:outline-none focus:border-[#ffb779]"
          placeholder="Describe your problem in your own words..."></textarea>
      </div>

      <ul id="submit-checklist" class="submit-checklist mb-4"></ul>

      <button type="button" id="analyze-btn"
        class="bg-[#cd7f32] hover:bg-[#ffb779] text-[#13100d] font-semibold px-4 py-2 rounded transition">
        Analyze with AI
      </button>
      <div id="case-details" class="mt-8"></div>
    </div>
  `;

  document.getElementById("mode-guided").addEventListener("click", () => setMode("guided"));
  document.getElementById("mode-freeform").addEventListener("click", () => setMode("freeform"));
  document.getElementById("analyze-btn").addEventListener("click", runAnalyze);

  ["field-who", "field-what", "field-why", "post-input"].forEach((id) => {
    document.getElementById(id)?.addEventListener("input", updateChecklist);
  });

  setMode("guided");
  currentDraft = null;

  return () => {
    currentDraft = null;
  };
}

async function runAnalyze() {
  const analyzeBtn = document.getElementById("analyze-btn");
  const output = document.getElementById("case-details");
  const text = buildCombinedText();

  if (!text) {
    output.innerHTML = `<p class="text-[#ffb779]">Please describe your problem first.</p>`;
    return;
  }

  analyzeBtn.disabled = true;
  analyzeBtn.textContent = "Analyzing…";
  output.innerHTML = `<p class="text-[#e5e2e1]/60">AI is validating…</p>`;

  try {
    currentDraft = await apiFetch("/submit/analyze", {
      method: "POST",
      body: JSON.stringify({ text }),
    });

    if (!currentDraft.isValid) {
      renderRejection(currentDraft);
      return;
    }

    output.innerHTML = renderSuccessPreview(currentDraft);
    const dup = currentDraft.isDuplicate;

    document.getElementById("confirm-btn").addEventListener("click", () =>
      confirmDraft(dup, output)
    );
    document.getElementById("cancel-btn").addEventListener("click", () => {
      currentDraft = null;
      output.innerHTML = "";
    });
  } catch (err) {
    output.innerHTML = `<p class="text-[#ffb779]">${escapeHtml(err.message)}</p>`;
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.textContent = "Analyze with AI";
    updateChecklist();
  }
}

async function confirmDraft(isDuplicate, output) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    alert("Please sign in first.");
    return;
  }

  try {
    const result = await apiFetch("/submit/confirm", {
      method: "POST",
      body: JSON.stringify({
        draftId: currentDraft.draftId,
        mergeIntoCaseId: isDuplicate ? currentDraft.duplicateCaseId : undefined,
      }),
    });

    emitDataChanged("submit");

    const caseId = result.case?.id;
    output.innerHTML = `
      <div class="submit-feedback submit-feedback--ok">
        <h2 class="submit-feedback__title text-[#43e2d2]">Submitted</h2>
        <p class="submit-feedback__body">${escapeHtml(result.message || result.case?.summary || "")}</p>
        <div class="flex flex-wrap gap-3 mt-4">
          <button type="button" id="goto-home" class="btn-primary text-sm">View on Home →</button>
          ${caseId && !result.matched ? `<button type="button" id="goto-case" class="btn-ghost text-sm">Open case</button>` : ""}
        </div>
      </div>`;

    if (mode === "guided") {
      document.getElementById("field-who").value = "";
      document.getElementById("field-what").value = "";
      document.getElementById("field-why").value = "";
    } else {
      document.getElementById("post-input").value = "";
    }
    currentDraft = null;
    updateChecklist();

    document.getElementById("goto-home").addEventListener("click", () => navigate("home"));
    document.getElementById("goto-case")?.addEventListener("click", () =>
      navigate("case", { id: caseId })
    );
  } catch (err) {
    alert(err.message);
  }
}
