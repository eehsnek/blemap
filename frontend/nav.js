import { navBrandHtml } from "./brand.js";
import { navigate } from "./router.js";

const COMMUNITY_LINKS = [
  { id: "home", label: "Home" },
  { id: "submit", label: "Submit" },
  { id: "matrix", label: "Matrix" },
  { id: "prospector", label: "Prospector" },
];

/** Steward desk — no community matrix/submit flow. */
const STEWARD_LINKS = [
  { id: "admin", label: "Queue", section: "queue" },
  { id: "admin", label: "Users", section: "users" },
  { id: "admin", label: "Scraping", section: "scrape" },
];

/**
 * @param {string} containerId
 * @param {string} activeId
 * @param {{ isAdmin?: boolean, section?: string }} [opts]
 */
export function mountNav(containerId, activeId, opts = {}) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const stewardMode = Boolean(opts.isAdmin);
  const section = opts.section || "queue";

  const links = stewardMode
    ? STEWARD_LINKS
    : COMMUNITY_LINKS;

  el.innerHTML = `
    ${navBrandHtml()}
    <nav id="sidebar-nav">
      ${
        stewardMode
          ? `<p class="nav-steward-label">Archive Steward</p>`
          : ""
      }
      ${links
        .map((l) => {
          const isActive = stewardMode
            ? activeId === "admin" && (l.section || "queue") === section
            : l.id === activeId;
          const routeAttr = stewardMode
            ? `data-route="admin" data-section="${l.section || "queue"}"`
            : `data-route="${l.id}"`;
          return `
        <button type="button" ${routeAttr}
          class="nav-link${isActive ? " is-active" : ""}">
          ${l.label}
        </button>`;
        })
        .join("")}
    </nav>
    <p style="margin-top:2rem;font-size:0.75rem;color:rgba(229,226,225,0.5)">
      ${stewardMode ? "Ops desk · not the community matrix" : "Living Archive"}
    </p>
  `;

  el.querySelectorAll("[data-route]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.section) {
        navigate("admin", { section: btn.dataset.section });
      } else {
        navigate(btn.dataset.route);
      }
    });
  });

  el.querySelector("#nav-home-logo")?.addEventListener("click", () => {
    navigate(stewardMode ? "admin" : "home");
  });
}
