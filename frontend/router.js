const listeners = new Set();

const ROUTE_TITLES = {
  home: "Case Map",
  submit: "Submit",
  matrix: "Matrix",
  prospector: "Prospector",
  admin: "Archive Steward",
  "steward-login": "Steward Sign-In",
  case: "Case",
  login: "Sign In",
  register: "Register",
  "forgot-password": "Forgot Password",
  "reset-password": "Reset Password",
};

const PUBLIC_AUTH_ROUTES = new Set([
  "login",
  "register",
  "steward-login",
  "forgot-password",
  "reset-password",
]);

const COMMUNITY_ROUTES = new Set([
  "home",
  "submit",
  "matrix",
  "prospector",
]);

export function parseRoute() {
  const raw = window.location.hash.slice(1).replace(/^\/+/, "");
  const parts = raw.split("/").filter(Boolean);
  const name = parts[0] || "home";
  const params = {};

  if (name === "case" && parts[1]) params.id = parts[1];
  if (name === "admin" && parts[1]) {
    const section = parts[1];
    if (["queue", "users", "scrape"].includes(section)) {
      params.section = section;
    }
  }

  const valid = [
    "home",
    "submit",
    "matrix",
    "prospector",
    "admin",
    "steward-login",
    "case",
    "login",
    "register",
    "forgot-password",
    "reset-password",
  ];
  if (!valid.includes(name)) {
    return { name: "home", params: {} };
  }

  return { name, params };
}

export function isPublicAuthRoute(name) {
  return PUBLIC_AUTH_ROUTES.has(name);
}

export function isCommunityRoute(name) {
  return COMMUNITY_ROUTES.has(name);
}

export function setPageTitle(routeName) {
  const label = ROUTE_TITLES[routeName] || "BleMap";
  document.title = routeName === "home" ? "BleMap" : `${label} · BleMap`;
}

export function navigate(name, params = {}) {
  if (name === "case" && params.id) {
    window.location.hash = `#/case/${params.id}`;
    return;
  }
  if (name === "admin" && params.section && params.section !== "queue") {
    window.location.hash = `#/admin/${params.section}`;
    return;
  }
  if (name === "admin") {
    window.location.hash = `#/admin`;
    return;
  }
  window.location.hash = `#/${name}`;
}

export function clearRoute() {
  const base = window.location.pathname + window.location.search;
  history.replaceState(null, "", base);
}

export function onRouteChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitRoute() {
  const route = parseRoute();
  setPageTitle(route.name);
  listeners.forEach((fn) => fn(route));
}

window.addEventListener("hashchange", () => emitRoute());

/** Only call when user is authenticated */
export function startAppRouter(preferredRoute) {
  if (preferredRoute) {
    if (preferredRoute.name === "case" && preferredRoute.params?.id) {
      navigate("case", { id: preferredRoute.params.id });
    } else if (preferredRoute.name === "admin") {
      navigate("admin", preferredRoute.params || {});
    } else {
      navigate(preferredRoute.name);
    }
  } else if (!window.location.hash || window.location.hash === "#") {
    navigate("home");
  }
  // Always run route handlers (hashchange does not fire if hash is unchanged).
  emitRoute();
}
