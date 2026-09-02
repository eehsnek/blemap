const LS_INGEST = "blemap:lastSeenIngestAt";
const LS_HIGH_GAP = "blemap:lastSeenHighGap";

let toastContainer = null;

function ensureContainer() {
  if (toastContainer) return toastContainer;
  toastContainer = document.createElement("div");
  toastContainer.id = "blemap-toasts";
  toastContainer.className = "blemap-toasts";
  document.body.appendChild(toastContainer);
  return toastContainer;
}

export function showToast(message, { duration = 5000, action } = {}) {
  const container = ensureContainer();
  const el = document.createElement("div");
  el.className = "blemap-toast";
  const msg = document.createElement("span");
  msg.className = "blemap-toast__msg";
  msg.textContent = String(message ?? "");
  el.appendChild(msg);
  if (action) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "blemap-toast__action";
    btn.textContent = action.label;
    btn.addEventListener("click", () => {
      action.onClick?.();
      el.remove();
    });
    el.appendChild(btn);
  }
  container.appendChild(el);
  setTimeout(() => el.classList.add("blemap-toast--visible"), 10);
  setTimeout(() => {
    el.classList.remove("blemap-toast--visible");
    setTimeout(() => el.remove(), 300);
  }, duration);
}

export function checkIngestNotification(lastRun) {
  if (!lastRun?.finished_at) return;
  const finished = new Date(lastRun.finished_at).getTime();
  const lastSeen = Number(localStorage.getItem(LS_INGEST) || 0);
  if (finished <= lastSeen) return;

  const promoted = lastRun.promoted_count ?? lastRun.promoted ?? 0;
  if (promoted > 0) {
    showToast(`${promoted} case(s) promoted from ingest`, {
      action: {
        label: "View Matrix",
        onClick: () => {
          import("../router.js").then(({ navigate }) => navigate("matrix"));
        },
      },
    });
  }
  localStorage.setItem(LS_INGEST, String(finished));
}

export function checkHighGapNotification(cases, threshold = 70) {
  const highGap = cases.filter(
    (c) => (c.gap_score ?? 0) >= threshold && !c.claimed_by
  );
  if (!highGap.length) return;

  const key = highGap.map((c) => c.id).sort().join(",");
  const lastSeen = localStorage.getItem(LS_HIGH_GAP);
  if (lastSeen === key) return;

  const top = highGap[0];
  showToast(`High-gap opportunity: ${top.topic} (gap ${top.gap_score})`, {
    action: {
      label: "Open",
      onClick: () => {
        import("../router.js").then(({ navigate }) =>
          navigate("case", { id: top.id })
        );
      },
    },
  });
  localStorage.setItem(LS_HIGH_GAP, key);
}
