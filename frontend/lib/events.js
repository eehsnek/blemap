const EVENT_NAME = "blemap:data-changed";

export function emitDataChanged(reason = "mutation") {
  window.dispatchEvent(
    new CustomEvent(EVENT_NAME, { detail: { reason, at: Date.now() } })
  );
}

export function onDataChanged(fn) {
  const handler = (e) => fn(e.detail);
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}

export function debounce(fn, ms = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
