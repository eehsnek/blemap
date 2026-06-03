import { navBrandHtml } from "./brand.js";
import { navigate } from "./router.js";

const LINKS = [
  { id: "home", label: "Home" },
  { id: "submit", label: "Submit" },
  { id: "matrix", label: "Matrix" },
  { id: "prospector", label: "Prospector" },
];

export function mountNav(containerId, activeId) {
  const el = document.getElementById(containerId);
  if (!el) return;

  el.innerHTML = `
    ${navBrandHtml()}
    <nav id="sidebar-nav">
      ${LINKS.map(
        (l) => `
        <button type="button" data-route="${l.id}"
          class="nav-link${l.id === activeId ? " is-active" : ""}">
          ${l.label}
        </button>`
      ).join("")}
    </nav>
    <p style="margin-top:2rem;font-size:0.75rem;color:rgba(229,226,225,0.5)">Living Archive</p>
  `;

  el.querySelectorAll("[data-route]").forEach((btn) => {
    btn.addEventListener("click", () => navigate(btn.dataset.route));
  });

  el.querySelector("#nav-home-logo")?.addEventListener("click", () => navigate("home"));
}
