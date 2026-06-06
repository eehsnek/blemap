import { escapeHtml } from "../util.js";

const DOMAINS = ["", "general", "law", "medicine", "tech", "finance", "community"];

/**
 * Mount filter bar; calls onChange(filters) with query params object.
 * @param {HTMLElement} container
 * @param {object} opts
 * @param {function} opts.onChange
 * @param {boolean} [opts.domainOnly]
 */
export function mountCaseFilters(container, { onChange, domainOnly = false }) {
  container.innerHTML = `
    <div class="case-filters">
      ${domainOnly ? "" : `<input type="search" id="cf-q" class="case-filters__input" placeholder="Search cases…" aria-label="Search cases">`}
      <select id="cf-domain" class="case-filters__select" aria-label="Filter by domain">
        ${DOMAINS.map((d) => `<option value="${escapeHtml(d)}">${d ? escapeHtml(d) : "All domains"}</option>`).join("")}
      </select>
      ${domainOnly ? "" : `
        <select id="cf-status" class="case-filters__select" aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="published">Published</option>
          <option value="pending">Pending</option>
        </select>
        <select id="cf-lifecycle" class="case-filters__select" aria-label="Filter by lifecycle">
          <option value="">All states</option>
          <option value="grey">Unresolved</option>
          <option value="orange">Claimed</option>
          <option value="green">Resolved</option>
        </select>
      `}
    </div>
  `;

  let debounceTimer;
  const emit = () => {
    const filters = {
      q: domainOnly ? null : document.getElementById("cf-q")?.value?.trim() || null,
      domain: document.getElementById("cf-domain")?.value || null,
      status: domainOnly ? null : document.getElementById("cf-status")?.value || null,
      lifecycle_state: domainOnly
        ? null
        : document.getElementById("cf-lifecycle")?.value || null,
    };
    onChange(filters);
  };

  const qEl = document.getElementById("cf-q");
  if (qEl) {
    qEl.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(emit, 300);
    });
  }

  container.querySelectorAll("select").forEach((el) => {
    el.addEventListener("change", emit);
  });

  return () => {
    clearTimeout(debounceTimer);
    container.innerHTML = "";
  };
}

export function filtersToQuery(filters = {}) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.domain) params.set("domain", filters.domain);
  if (filters.status) params.set("status", filters.status);
  if (filters.lifecycle_state) params.set("lifecycle_state", filters.lifecycle_state);
  if (filters.view) params.set("view", filters.view);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
