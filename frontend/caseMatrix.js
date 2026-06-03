import { apiFetch } from "./api.js";
import { caseDetailUrl } from "./config.js";

const BUBBLE_SIZE = 70;
const PADDING = 40;

const QUADRANT_LABELS = {
  urgent_gap: "Urgent gap",
  painful_solved: "Painful but solved",
  saturated: "Saturated",
  hidden_gem: "Hidden gem",
};

function renderBubble(c, matrix, maxX = 1, maxY = 1) {
  const bubble = document.createElement("div");
  const state = (c.lifecycle_state || "").toLowerCase().trim();
  let background = "rgba(179, 176, 171, 0.18)";
  let textColor = "#e5e2e1";
  let shadow = "0 18px 42px rgba(0, 0, 0, 0.22)";

  if (state === "orange") {
    background = "linear-gradient(135deg, #ffb779 0%, #cd7f32 100%)";
    textColor = "#13100d";
    shadow = "0 18px 42px rgba(255, 183, 121, 0.24)";
  }
  if (state === "green") {
    background = "linear-gradient(135deg, #43e2d2 0%, #00c6b6 100%)";
    textColor = "#13100d";
    shadow = "0 18px 42px rgba(67, 226, 210, 0.22)";
  }

  const width = matrix.clientWidth;
  const height = matrix.clientHeight;

  const xVal = c.has_solution ? 1 : 0.15 + (Number(c.solve_count ?? 0) / maxX) * 0.85;
  const yVal = Number(c.pain_level ?? c.pain_count / maxY ?? 0.5);

  const usableWidth = width - BUBBLE_SIZE - PADDING * 2;
  const usableHeight = height - BUBBLE_SIZE - PADDING * 2;
  const x = PADDING + Math.min(xVal, 1) * usableWidth;
  const y = PADDING + (1 - Math.min(yVal, 1)) * usableHeight;
  const size = BUBBLE_SIZE + Math.min(yVal, 1) * 36;

  bubble.setAttribute("data-bubble", "true");
  bubble.className =
    "absolute rounded-full flex items-center justify-center text-center cursor-pointer bubble-card";
  bubble.style.width = `${size}px`;
  bubble.style.height = `${size}px`;
  bubble.style.left = `${x}px`;
  bubble.style.top = `${y}px`;
  bubble.style.background = background;
  bubble.style.color = textColor;
  bubble.style.boxShadow = shadow;
  bubble.style.border =
    state === "grey" ? "1px solid rgba(83, 68, 56, 0.24)" : "none";
  bubble.style.fontSize = "0.72rem";
  bubble.style.fontWeight = "600";
  bubble.textContent = c.topic?.slice(0, 24) + (c.topic?.length > 24 ? "…" : "");

  const quadrant = QUADRANT_LABELS[c.matrix_quadrant] || c.matrix_quadrant;
  bubble.title = `${c.topic}\nGap: ${c.gap_score} · ${quadrant}\nPain: ${c.pain_count} · Solutions: ${c.solve_count}`;
  bubble.setAttribute("aria-label", bubble.title);

  bubble.onclick = () => {
    window.location.href = caseDetailUrl(c.id);
  };

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
    const empty = document.createElement("p");
    empty.className =
      "matrix-empty absolute top-1/2 left-1/2 -translate-x-1/2 text-[#e5e2e1]/50 text-center px-4";
    empty.textContent = "No published cases on the matrix yet.";
    matrix.appendChild(empty);
    return;
  }

  const maxX = Math.max(...cases.map((c) => c.solve_count), 1);
  const maxY = Math.max(...cases.map((c) => c.pain_level ?? 0), 0.01);

  cases.forEach((c) => matrix.appendChild(renderBubble(c, matrix, maxX, maxY)));
}

renderMatrix();

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(renderMatrix, 150);
});
