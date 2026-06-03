import { apiFetch } from "./api.js";
import { caseDetailUrl } from "./config.js";

const BUBBLE_SIZE = 70;
const PADDING = 40;

function renderBubble(c, matrix, maxSolve = 1, maxPain = 1) {
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

  const solve = Number(c.solve_count ?? 0);
  const pain = Number(c.pain_count ?? 0);

  const usableWidth = width - BUBBLE_SIZE - PADDING * 2;
  const usableHeight = height - BUBBLE_SIZE - PADDING * 2;

  const x = PADDING + (solve / maxSolve) * usableWidth;
  const y = PADDING + ((maxPain - pain) / maxPain) * usableHeight;
  const size = BUBBLE_SIZE + (pain / maxPain) * 30;

  bubble.setAttribute("data-bubble", "true");
  bubble.className =
    "absolute rounded-full flex items-center justify-center text-center cursor-pointer bubble-card";
  bubble.style.width = `${size}px`;
  bubble.style.height = `${size}px`;
  bubble.style.left = `${x}px`;
  bubble.style.top = `${y}px`;
  bubble.style.padding = "6px";
  bubble.style.background = background;
  bubble.style.color = textColor;
  bubble.style.boxShadow = shadow;
  bubble.style.border =
    state === "grey" ? "1px solid rgba(83, 68, 56, 0.24)" : "none";
  bubble.style.fontSize = "0.78rem";
  bubble.style.fontWeight = "600";
  bubble.style.letterSpacing = "0.01em";
  bubble.style.lineHeight = "1.1";
  bubble.textContent = c.topic;

  bubble.title = `${c.topic} · Pain: ${pain} · Solve: ${solve}`;

  bubble.onclick = () => {
    window.location.href = caseDetailUrl(c.id);
  };

  return bubble;
}

async function renderMatrix() {
  const matrix = document.getElementById("matrix");
  if (!matrix) return;

  matrix.querySelectorAll("[data-bubble]").forEach((b) => b.remove());
  matrix.querySelectorAll(".matrix-empty").forEach((el) => el.remove());

  let cases = [];
  try {
    cases = await apiFetch("/cases");
  } catch (err) {
    console.error("Failed to fetch cases:", err);
  }

  if (cases.length === 0) {
    const empty = document.createElement("p");
    empty.className =
      "matrix-empty absolute top-1/2 left-1/2 -translate-x-1/2 text-gray-400";
    empty.textContent = "No cases yet.";
    matrix.appendChild(empty);
    return;
  }

  const maxSolve = Math.max(...cases.map((c) => Number(c.solve_count ?? 0)), 1);
  const maxPain = Math.max(...cases.map((c) => Number(c.pain_count ?? 0)), 1);

  cases.forEach((c) => {
    matrix.appendChild(renderBubble(c, matrix, maxSolve, maxPain));
  });
}

renderMatrix();

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(renderMatrix, 150);
});
