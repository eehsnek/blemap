import { supabase } from "../database/supabase.js";

async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

const API_BASE = "http://localhost:4000/api";

async function getAppUser() {
  const authUser = await getCurrentUser();

  if (!authUser?.id) return null;

  const { data } = await supabase
    .from("users")
    .select("id, username, email")
    .eq("id", authUser.id)
    .single();

  return data || {
    id: authUser.id,
    email: authUser.email,
    username: null
  };
}

async function fetchProfileReport(user) {
  if (!user || !user.id) {
    console.error("Invalid user passed to fetchProfileReport:", user);
    return null;
  }

  try {
    const url = `http://localhost:4000/api/users/${user.id}/profile-report`;

    const res = await fetch(url);

    if (!res.ok) {
      const err = await res.text();
      console.error("API error:", err);
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error("Network error:", err);
    return null;
  }
}

function renderIdentity(user) {
  const identity = document.getElementById("identity");

  if (!user) {
    identity.innerHTML = "<p class='text-muted'>Identity unavailable</p>";
    return;
  }

  const displayName = user.username ?? user.email ?? "Unknown user";

  identity.innerHTML = `
    <div style="padding: var(--spacing-lg);">
      <h2 class="title-large mb-md">${displayName}</h2>
      <p class="text-muted mb-0">User ID: ${user.id}</p>
    </div>
  `;
}

function renderSummary(summary) {
  const container = document.getElementById("summaryCards");

  const stats = [
    { label: "Cases Claimed", value: summary.cases_claimed },
    { label: "Takes Submitted", value: summary.takes_submitted },
    { label: "Interactions", value: summary.pain_interactions },
    { label: "Resolved", value: summary.cases_helped_resolved }
  ];

  container.innerHTML = stats.map(stat => `
    <div class="card card-default">
      <div class="data-point" style="border-bottom: none; padding: 0;">
        <span class="data-label">${stat.label}</span>
        <span class="data-value">${stat.value}</span>
      </div>
    </div>
  `).join("");
}

function renderList(title, items, mapper) {
  const fragment = document.createDocumentFragment();

  if (!items || items.length === 0) {
    const emptyDiv = document.createElement("div");
    emptyDiv.className = "card card-default";
    emptyDiv.style.padding = "var(--spacing-lg)";
    emptyDiv.innerHTML = '<p class="text-muted mb-0">No data</p>';
    fragment.appendChild(emptyDiv);
    return fragment;
  }

  items.forEach(item => {
    const card = document.createElement("div");
    card.className = "card card-default card-hover";
    card.style.padding = "var(--spacing-lg)";
    card.innerHTML = mapper(item);
    fragment.appendChild(card);
  });

  return fragment;
}

async function initProfile() {
  const user = await getCurrentUser();

  if (!user?.id) {
    document.body.innerHTML = "<h2>Please login</h2>";
    return;
  }

  const data = await fetchProfileReport(user);

  if (!data?.user || !data?.summary || !data?.reports) {
    document.body.innerHTML = "<h2>Failed to load profile data</h2>";
    return;
  }

  renderIdentity(data.user);
  renderSummary(data.summary);

  document.getElementById("takesByCase")
    .appendChild(renderList(
      "takes",
      data.reports.takes_by_case,
      (c) => `<div>
        <p class="title-small mb-sm text-primary">${c.topic}</p>
        <p class="text-muted mb-0">${c.count} takes</p>
      </div>`
    ));

  document.getElementById("resolvedCases")
    .appendChild(renderList(
      "resolved",
      data.reports.resolved_cases,
      (c) => `<div>
        <p class="title-small mb-sm text-secondary">${c.topic}</p>
        <p class="body-medium mb-0">${c.solve_text}</p>
        <p class="text-muted mt-sm mb-0">✅ Resolved</p>
      </div>`
    ));

  document.getElementById("painCases")
    .appendChild(renderList(
      "pain",
      data.reports.pain_cases,
      (c) => `<div>
        <p class="title-small mb-0 text-primary">${c.topic}</p>
      </div>`
    ));

    console.log("AUTH USER:", user);
}

initProfile();