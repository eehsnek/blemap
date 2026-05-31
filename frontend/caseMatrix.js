const mockCases = [
  {
    topic: "Housing dispute",
    pain_count: 12,
    solve_count: 5,
    lifecycle_state: "orange",
    claimed_by: "user123"
  },
  {
    topic: "Workplace complaint",
    pain_count: 8,
    solve_count: 3,
    lifecycle_state: "grey",
    claimed_by: null
  },
  {
    topic: "Consumer fees issue",
    pain_count: 2,
    solve_count: 10,
    lifecycle_state: "green",
    claimed_by: "user789"
  },
  {
    topic: "Neighbor conflict",
    pain_count: 1,
    solve_count: 0,
    lifecycle_state: "grey",
    claimed_by: null
  }
];

const maxSolve = Math.max(...mockCases.map(c => c.solve_count), 1);
const maxPain = Math.max(...mockCases.map(c => c.pain_count), 1);

const BUBBLE_SIZE = 70;
const PADDING = 40; // keeps bubbles away from edges

async function fetchCases() {
  try {
        const response = await fetch("http://localhost:4000/api/cases");
        const data = await response.json();
        return data;
    } catch (err) {
        console.error("Failed to fetch cases:", err);
        return [];
    }
}

function renderBubble(c, matrix, maxSolve = 1, maxPain = 1) {
    const bubble = document.createElement("div")

    const state = (c.lifecycle_state || "").toLowerCase().trim()
    let background = "rgba(179, 176, 171, 0.18)"
    let textColor = "#e5e2e1"
    let shadow = "0 18px 42px rgba(0, 0, 0, 0.22)"

    if (state === "orange") {
      background = "linear-gradient(135deg, #ffb779 0%, #cd7f32 100%)"
      textColor = "#13100d"
      shadow = "0 18px 42px rgba(255, 183, 121, 0.24)"
    }

    if (state === "green") {
      background = "linear-gradient(135deg, #43e2d2 0%, #00c6b6 100%)"
      textColor = "#13100d"
      shadow = "0 18px 42px rgba(67, 226, 210, 0.22)"
    }

    const width = matrix.clientWidth
    const height = matrix.clientHeight

    const solve = Number(c.solve_count ?? 0)
    const pain = Number(c.pain_count ?? 0)

    const usableWidth = width - BUBBLE_SIZE - PADDING * 2
    const usableHeight = height - BUBBLE_SIZE - PADDING * 2

    const x = PADDING + (solve / maxSolve) * usableWidth
    const y = PADDING + ((maxPain - pain) / maxPain) * usableHeight
    const size = BUBBLE_SIZE + (pain / maxPain) * 30

    bubble.setAttribute("data-bubble", "true")
    bubble.className = "absolute rounded-full flex items-center justify-center text-center cursor-pointer bubble-card"
    bubble.style.width = `${size}px`
    bubble.style.height = `${size}px`
    bubble.style.left = `${x}px`
    bubble.style.top = `${y}px`
    bubble.style.padding = "6px"
    bubble.style.background = background
    bubble.style.color = textColor
    bubble.style.boxShadow = shadow
    bubble.style.border = state === "grey" ? "1px solid rgba(83, 68, 56, 0.24)" : "none"
    bubble.style.fontSize = "0.78rem"
    bubble.style.fontWeight = "600"
    bubble.style.letterSpacing = "0.01em"
    bubble.style.lineHeight = "1.1"
    bubble.textContent = c.topic

    bubble.title = `${c.topic} · Pain: ${pain} · Solve: ${solve}`

    bubble.onclick = () => {
        window.location.href = `http://localhost:3000/frontend/caseDetail?id=${c.id}`;
    };

    return bubble
}

const matrix = document.getElementById("matrix");

async function renderMatrix() {
    const matrix = document.getElementById("matrix");
    
    matrix.querySelectorAll("[data-bubble]")
      .forEach(b => b.remove());

    // Fetch real data
    const cases = await fetchCases();

    if (cases.length === 0) {
        matrix.innerHTML += `<p class="absolute top-1/2 left-1/2 -translate-x-1/2 text-gray-400">No cases yet.</p>`;
        return;
    }

    const maxSolve = Math.max(
        ...cases.map(c => Number(c.solve_count ?? 0)),
        1
    );

    const maxPain = Math.max(
        ...cases.map(c => Number(c.pain_count ?? 0)),
        1
    );

    cases.forEach(c => {
        matrix.appendChild(
            renderBubble(c, matrix, maxSolve, maxPain)
        );
    });
}

renderMatrix()

let resizeTimer
window.addEventListener("resize", () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(renderMatrix, 150)
})