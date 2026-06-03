import { apiFetch } from "../api.js";
import { navigate } from "../router.js";

const BUBBLE_SIZE = 70;
const PADDING = 40;
let resizeHandler = null;

export function mount(container) {
  container.innerHTML = `
    <div>
      <p class="text-sm uppercase tracking-wide text-[#43e2d2] mb-1">Case Matrix</p>
      <h1 class="text-3xl font-bold mb-2 text-[#ffb779]">Pressure vs. Progress</h1>
      <p class="text-[#e5e2e1]/70 mb-6 max-w-2xl">Published cases only. Y = pain level, X = solution existence. Click a node for details.</p>
      <div class="grid gap-6 lg:grid-cols-[240px_1fr]">
        <div class="bg-[#201a16] rounded-xl p-4 border border-[#534438]/30 text-sm space-y-3">
          <p><span class="inline-block w-3 h-3 rounded-full bg-[#7c7c7c] mr-2"></span>Unclaimed</p>
          <p><span class="inline-block w-3 h-3 rounded-full bg-gradient-to-br from-[#ffb779] to-[#cd7f32] mr-2"></span>Claimed</p>
          <p><span class="inline-block w-3 h-3 rounded-full bg-gradient-to-br from-[#43e2d2] to-[#00c6b6] mr-2"></span>Resolved</p>
        </div>
        <div class="relative rounded-2xl overflow-hidden bg-[#161414]/90 border border-[#534438]/20" style="min-height:480px">
          <div id="matrix" class="matrix-canvas relative w-full h-[480px]">
            <div class="axis-line axis-h"></div>
            <div class="axis-line axis-v"></div>
            <p class="matrix-label matrix-label-x">Solution existence →</p>
            <p class="matrix-label matrix-label-y">Pain level →</p>
          </div>
        </div>
      </div>
    </div>
  `;

  renderMatrix();

  resizeHandler = () => {
    clearTimeout(resizeHandler._t);
    resizeHandler._t = setTimeout(renderMatrix, 150);
  };
  window.addEventListener("resize", resizeHandler);

  return () => {
    window.removeEventListener("resize", resizeHandler);
  };
}

function renderBubble(c, matrix, maxX, maxY) {
  const bubble = document.createElement("button");
  bubble.type = "button";
  const state = (c.lifecycle_state || "").toLowerCase();

  let background = "rgba(179, 176, 171, 0.18)";
  let textColor = "#e5e2e1";
  if (state === "orange") {
    background = "linear-gradient(135deg, #ffb779 0%, #cd7f32 100%)";
    textColor = "#13100d";
  }
  if (state === "green") {
    background = "linear-gradient(135deg, #43e2d2 0%, #00c6b6 100%)";
    textColor = "#13100d";
  }

  const xVal = c.has_solution ? 1 : 0.15 + (Number(c.solve_count ?? 0) / maxX) * 0.85;
  const yVal = Number(c.pain_level ?? 0.5);
  const w = matrix.clientWidth;
  const h = matrix.clientHeight;
  const size = BUBBLE_SIZE + Math.min(yVal, 1) * 36;
  const x = PADDING + Math.min(xVal, 1) * (w - size - PADDING * 2);
  const y = PADDING + (1 - Math.min(yVal, 1)) * (h - size - PADDING * 2);

  bubble.setAttribute("data-bubble", "true");
  bubble.className = "matrix-bubble absolute rounded-full flex items-center justify-center text-center cursor-pointer border-0";
  bubble.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px;background:${background};color:${textColor};font-size:0.72rem;font-weight:600;padding:4px`;
  bubble.textContent = (c.topic || "").slice(0, 22);
  bubble.title = `${c.topic}\nGap: ${c.gap_score}`;
  bubble.addEventListener("click", () => navigate("case", { id: c.id }));

  return bubble;
}

async function renderMatrix() {
  const matrix = document.getElementById("matrix");
  if (!matrix) return;

  matrix.querySelectorAll("[data-bubble], .matrix-empty").forEach((el) => el.remove());

  let cases = [];
  try {
    cases = await apiFetch("/cases?view=matrix");
  } catch (err) {
    console.error(err);
  }

  if (!cases.length) {
    const empty = document.createElement("div");
    empty.className =
      "matrix-empty absolute inset-0 flex flex-col items-center justify-center text-center px-6 gap-4";
    empty.innerHTML = `
      <p class="text-[#e5e2e1]/70 max-w-sm">No published cases on the matrix yet. Cases appear here after community validation.</p>
      <div class="flex flex-wrap gap-2 justify-center">
        <button type="button" class="btn-primary" data-goto-home>Go to Home</button>
        <button type="button" class="btn-secondary" data-goto-submit>Submit a case</button>
      </div>
    `;
    empty.querySelector("[data-goto-home]")?.addEventListener("click", () => navigate("home"));
    empty.querySelector("[data-goto-submit]")?.addEventListener("click", () => navigate("submit"));
    matrix.appendChild(empty);
    return;
  }

  const maxX = Math.max(...cases.map((c) => c.solve_count), 1);
  const maxY = Math.max(...cases.map((c) => c.pain_level ?? 0), 0.01);
  cases.forEach((c) => matrix.appendChild(renderBubble(c, matrix, maxX, maxY)));
}
