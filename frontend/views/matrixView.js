import { apiFetch } from "../api.js";
import { navigate } from "../router.js";
import { escapeHtml } from "../util.js";
import { onDataChanged, debounce } from "../lib/events.js";
import { mountCaseFilters, filtersToQuery } from "../components/caseFilters.js";

const INSET = { top: 20, right: 28, bottom: 20, left: 20 };
const MIN_GAP = 10;
const POLL_MS = 60_000;

let resizeHandler = null;
let pollTimer = null;
let prevSnapshot = new Map();
let currentFilters = {};

function bubbleLabel(topic, size) {
  const t = (topic || "Case").trim();
  if (t.length <= 36 || size >= 110) return t;
  const words = t.split(/\s+/).filter(Boolean);
  if (size >= 95) return words.slice(0, 6).join(" ");
  if (size >= 82) return words.slice(0, 4).join(" ");
  if (size >= 72) return words.slice(0, 3).join(" ");
  return words.slice(0, 2).join(" ") || t.slice(0, 12);
}

function bubbleSize(c) {
  const gap = Number(c.gap_score ?? 40) / 100;
  const pain = Math.min(Number(c.pain_level ?? 0.35), 1);
  return Math.round(78 + gap * 48 + pain * 24);
}

function bubbleClass(c) {
  const state = (c.lifecycle_state || "grey").toLowerCase();
  if (state === "green") return "matrix-bubble--green";
  if (state === "orange") return "matrix-bubble--orange";
  return "matrix-bubble--grey";
}

function plotMetrics(plotEl) {
  const w = plotEl.clientWidth;
  const h = plotEl.clientHeight;
  return {
    innerW: Math.max(w - INSET.left - INSET.right, 100),
    innerH: Math.max(h - INSET.top - INSET.bottom, 100),
  };
}

function basePosition(c, plotEl, maxSolve) {
  const { innerW, innerH } = plotMetrics(plotEl);
  const size = bubbleSize(c);

  const solves = Number(c.solve_count ?? 0);
  let xNorm = maxSolve > 0 ? solves / maxSolve : 0;
  if (c.has_solution || c.lifecycle_state === "green") {
    xNorm = Math.max(xNorm, 0.9);
  } else {
    xNorm = 0.05 + xNorm * 0.85;
  }

  const painNorm = Math.min(Math.max(Number(c.pain_level ?? 0.15), 0.08), 1);

  let x = INSET.left + xNorm * (innerW - size);
  let y = INSET.top + (1 - painNorm) * (innerH - size);

  x = Math.max(INSET.left, Math.min(x, INSET.left + innerW - size));
  y = Math.max(INSET.top, Math.min(y, INSET.top + innerH - size));

  return { x, y, size, innerW, innerH };
}

function circlesOverlap(x1, y1, s1, x2, y2, s2, gap) {
  const dist = Math.hypot(x1 + s1 / 2 - (x2 + s2 / 2), y1 + s1 / 2 - (y2 + s2 / 2));
  return dist < s1 / 2 + s2 / 2 + gap;
}

function resolveCollision(x, y, size, placed, bounds) {
  let cx = x;
  let cy = y;
  for (let attempt = 0; attempt < 28; attempt++) {
    const hit = placed.some((p) =>
      circlesOverlap(cx, cy, size, p.x, p.y, p.size, MIN_GAP)
    );
    if (!hit) return { x: cx, y: cy };
    const angle = ((attempt * 137.5) % 360) * (Math.PI / 180);
    const r = 14 + attempt * 8;
    cx = Math.max(INSET.left, Math.min(x + Math.cos(angle) * r, bounds.maxX - size));
    cy = Math.max(INSET.top, Math.min(y + Math.sin(angle) * r, bounds.maxY - size));
  }
  return { x: cx, y: cy };
}

function caseSnapshotKey(c) {
  return `${c.pain_count}|${c.lifecycle_state}|${c.gap_score}`;
}

function renderBubble(c, pos, updated) {
  const { x, y, size } = pos;
  const bubble = document.createElement("button");
  bubble.type = "button";
  bubble.setAttribute("data-bubble", "true");
  bubble.setAttribute("data-case-id", c.id);
  bubble.className = `matrix-bubble ${bubbleClass(c)}${updated ? " bubble-updated" : ""}`;
  bubble.style.width = `${size}px`;
  bubble.style.height = `${size}px`;
  bubble.style.left = `${x}px`;
  bubble.style.top = `${y}px`;

  const fontSize = Math.max(0.62, Math.min(0.78, size / 120));
  const label = bubbleLabel(c.topic, size);
  bubble.innerHTML = `<span class="matrix-bubble__text" style="font-size:${fontSize}rem">${escapeHtml(label)}</span>`;
  bubble.title = `${c.topic}\nGap: ${c.gap_score ?? "—"} · Pain: ${c.pain_count ?? 0} · Solves: ${c.solve_count ?? 0}`;
  bubble.addEventListener("click", () => navigate("case", { id: c.id }));
  if (updated) {
    setTimeout(() => bubble.classList.remove("bubble-updated"), 1000);
  }
  return bubble;
}

async function loadMetricsLegend() {
  const footer = document.getElementById("matrix-legend-stats");
  if (!footer) return;
  try {
    const m = await apiFetch("/metrics/summary");
    const q = m.byQuadrant ?? {};
    footer.innerHTML = `
      <strong>Live archive:</strong>
      ${m.totals?.published ?? 0} published ·
      urgent gap ${q.urgent_gap ?? 0} ·
      hidden gem ${q.hidden_gem ?? 0} ·
      ${m.prospector?.unclaimed ?? 0} unclaimed (avg gap ${m.prospector?.avgGap ?? 0})
    `;
  } catch {
    footer.textContent = "Matrix updates every 60s and when cases change.";
  }
}

export async function renderMatrix() {
  const plot = document.getElementById("matrix-plot");
  const zone = document.getElementById("matrix-plot-zone");
  if (!plot) return;

  plot.querySelectorAll("[data-bubble]").forEach((el) => el.remove());
  zone?.querySelectorAll(".matrix-empty")?.forEach((el) => el.remove());

  let cases = [];
  try {
    const qs = filtersToQuery({ ...currentFilters, view: "matrix" });
    cases = await apiFetch(`/cases${qs}`);
  } catch (err) {
    console.error(err);
  }

  if (!cases.length) {
    const empty = document.createElement("div");
    empty.className = "matrix-empty";
    empty.innerHTML = `
      <p>No published cases on the matrix yet.</p>
      <div class="btn-row">
        <button type="button" class="btn-primary" data-goto-home>Case Map</button>
        <button type="button" class="btn-secondary" data-goto-submit">Submit</button>
      </div>`;
    empty.querySelector("[data-goto-home]")?.addEventListener("click", () => navigate("home"));
    empty.querySelector("[data-goto-submit]")?.addEventListener("click", () => navigate("submit"));
    zone?.appendChild(empty);
    return;
  }

  const maxSolve = Math.max(...cases.map((c) => Number(c.solve_count) || 0), 1);
  cases.sort((a, b) => bubbleSize(b) - bubbleSize(a));
  const placed = [];
  const nextSnapshot = new Map();

  for (const c of cases) {
    const key = caseSnapshotKey(c);
    nextSnapshot.set(c.id, key);
    const updated = prevSnapshot.has(c.id) && prevSnapshot.get(c.id) !== key;

    const base = basePosition(c, plot, maxSolve);
    const bounds = {
      maxX: INSET.left + base.innerW,
      maxY: INSET.top + base.innerH,
    };
    const { x, y } = resolveCollision(base.x, base.y, base.size, placed, bounds);
    placed.push({ x, y, size: base.size });
    plot.appendChild(renderBubble(c, { x, y, size: base.size }, updated));
  }

  prevSnapshot = nextSnapshot;
  loadMetricsLegend();
}

export function mount(container) {
  container.innerHTML = `
    <div class="matrix-page">
      <header class="matrix-page-header">
        <p class="page-eyebrow">Case Matrix</p>
        <h1 class="page-title page-title--serif">Pressure vs. Progress</h1>
        <p class="page-lead">
          Visualize active case momentum across pain and solve counts. Each node is a living problem,
          framed within the bronze/patina system.
        </p>
      </header>
      <div id="matrix-filters" class="matrix-filters-wrap"></div>
      <div class="matrix-layout">
        <aside class="matrix-legend">
          <h2 class="matrix-legend__title">Legend &amp; Narrative</h2>
          <div class="matrix-legend__item">
            <div class="matrix-legend__item-head">
              <span class="legend-dot legend-dot--grey"></span>
              Unresolved
            </div>
            <p>Cases still waiting for traction.</p>
          </div>
          <div class="matrix-legend__item">
            <div class="matrix-legend__item-head">
              <span class="legend-dot legend-dot--orange"></span>
              Claimed
            </div>
            <p>Bronze-problem nodes that teams are engaging.</p>
          </div>
          <div class="matrix-legend__item">
            <div class="matrix-legend__item-head">
              <span class="legend-dot legend-dot--green"></span>
              Resolved
            </div>
            <p>Patina-solution nodes with progress built in.</p>
          </div>
          <p class="matrix-legend__footer" id="matrix-legend-stats">
            Loading live stats…
          </p>
        </aside>
        <div class="matrix-frame">
          <span class="matrix-frame__expand" aria-hidden="true">⤢</span>
          <div class="matrix-canvas">
            <p class="matrix-label matrix-label-y">Pain intensity →</p>
            <div class="matrix-plot-zone" id="matrix-plot-zone">
              <div class="matrix-plot-inner" id="matrix-plot">
                <div class="axis-line axis-h"></div>
                <div class="axis-line axis-v"></div>
              </div>
            </div>
            <p class="matrix-label matrix-label-x">Solve Count →</p>
          </div>
        </div>
      </div>
    </div>
  `;

  const debouncedRender = debounce(() => renderMatrix(), 300);

  const filterCleanup = mountCaseFilters(
    document.getElementById("matrix-filters"),
    {
      domainOnly: true,
      onChange: (filters) => {
        currentFilters = filters;
        renderMatrix();
      },
    }
  );

  renderMatrix();
  pollTimer = setInterval(renderMatrix, POLL_MS);

  resizeHandler = () => {
    clearTimeout(resizeHandler._t);
    resizeHandler._t = setTimeout(renderMatrix, 150);
  };
  window.addEventListener("resize", resizeHandler);

  const unsubData = onDataChanged(debouncedRender);

  return () => {
    window.removeEventListener("resize", resizeHandler);
    clearInterval(pollTimer);
    unsubData();
    filterCleanup?.();
  };
}
