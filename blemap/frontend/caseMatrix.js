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

const maxSolve = Math.max(...mockCases.map(c => Number(c.solve_count ?? 0)), 1);
const maxPain = Math.max(...mockCases.map(c => Number(c.pain_count ?? 0)), 1);

const BUBBLE_SIZE = 70;
const PADDING = 40; // keeps bubbles away from edges

function renderBubble(c, matrix) {
    const bubble = document.createElement("div")

    const state = (c.lifecycle_state || "").toLowerCase().trim()
    let color = "bg-gray-400"
    if (state === "orange") color = "bg-orange-400"
    if (state === "green") color = "bg-green-400"

    const width = matrix.clientWidth
    const height = matrix.clientHeight

    const solve = Number(c.solve_count ?? 0)
    const pain = Number(c.pain_count ?? 0)

    const usableWidth = width - BUBBLE_SIZE - PADDING * 2
    const usableHeight = height - BUBBLE_SIZE - PADDING * 2

    const x = PADDING + (solve / maxSolve) * usableWidth
    const y = PADDING + ((maxPain - pain) / maxPain) * usableHeight

    const size = BUBBLE_SIZE + (pain / maxPain) * 30

    // Use data attribute for reliable identification
    bubble.setAttribute("data-bubble", "true")

    bubble.className = `
        absolute rounded-full text-white text-xs
        flex items-center justify-center text-center
        shadow cursor-pointer ${color}
    `

    bubble.style.width = `${size}px`
    bubble.style.height = `${size}px`
    bubble.style.left = `${x}px`
    bubble.style.top = `${y}px`
    bubble.style.padding = "4px"
    bubble.textContent = c.topic

    return bubble
}

const matrix = document.getElementById("matrix");

mockCases.forEach(c => {
  matrix.appendChild(renderBubble(c, matrix));
});

function renderMatrix() {
    const matrix = document.getElementById("matrix")
    matrix.querySelectorAll("[data-bubble]").forEach(b => b.remove())
    mockCases.forEach(c => matrix.appendChild(renderBubble(c, matrix)))
}

renderMatrix()

let resizeTimer
window.addEventListener("resize", () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(renderMatrix, 150)
})