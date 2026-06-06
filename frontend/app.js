import { supabase } from "./supabaseClient.js";
import { mountNav } from "./nav.js";
import {
  parseRoute,
  navigate,
  onRouteChange,
  startAppRouter,
  clearRoute,
  setPageTitle,
} from "./router.js";
import * as authView from "./views/authView.js";

const bootScreen = document.getElementById("boot-screen");
const authScreen = document.getElementById("auth-screen");
const appShell = document.getElementById("app-shell");
const mainContent = document.getElementById("main-content");
const authStatus = document.getElementById("auth-status");

let viewCleanup = null;
let authMounted = false;
let isAuthenticated = false;
let pendingReturnRoute = null;

const VIEW_LOADERS = {
  home: () => import("./views/homeView.js"),
  submit: () => import("./views/submitView.js"),
  matrix: () => import("./views/matrixView.js"),
  prospector: () => import("./views/prospectorView.js"),
  case: () => import("./views/caseView.js"),
};

function showBootOnly() {
  bootScreen.style.display = "flex";
  authScreen.style.display = "none";
  appShell.style.display = "none";
}

function showAuthOnly() {
  if (bootScreen) bootScreen.style.display = "none";
  if (appShell) appShell.style.display = "none";
  if (authScreen) authScreen.style.display = "block";
  document.title = "Sign In · BleMap";

  if (!authMounted) {
    viewCleanup?.();
    viewCleanup = authView.mount(authScreen);
    authMounted = true;
  }
}

function showAppOnly() {
  if (bootScreen) bootScreen.style.display = "none";
  if (authScreen) authScreen.style.display = "none";
  if (appShell) appShell.style.display = "flex";
  authMounted = false;
}

async function updateAuthStatus() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (authStatus && user) {
    authStatus.textContent = `Signed in as ${user.email}`;
  }
}

function setMainLoading(loading) {
  if (!mainContent) return;
  mainContent.classList.toggle("main-loading", loading);
}

async function renderRoute(route) {
  if (route.name === "login" || route.name === "register") {
    navigate("home");
    return;
  }

  setPageTitle(route.name);
  viewCleanup?.();
  viewCleanup = null;

  mountNav("app-nav", route.name === "case" ? "home" : route.name);

  const loadView = VIEW_LOADERS[route.name];
  if (!loadView) {
    mainContent.innerHTML = `<p>Unknown page</p>`;
    return;
  }

  mainContent.classList.remove("main-content--wide");
  if (route.name === "matrix") {
    mainContent.classList.add("main-content--wide");
  }

  setMainLoading(true);
  try {
    const view = await loadView();
    if (route.name === "case") {
      viewCleanup = await view.mount(mainContent, route.params);
    } else if (route.name === "home") {
      viewCleanup = await view.mount(mainContent);
    } else {
      viewCleanup = view.mount(mainContent);
    }
    document.getElementById("js-error").style.display = "none";
  } catch (err) {
    console.error("[BleMap] view load failed", err);
    mainContent.innerHTML = `<p class="page-lead" style="color:#ffb779">Could not load this page: ${err.message}</p>`;
    window.__blemapShowError?.(err.message);
  } finally {
    setMainLoading(false);
  }
}

const SESSION_TIMEOUT_MS = 4000;

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    }),
  ]);
}

async function requireSession() {
  try {
    const { data } = await withTimeout(
      supabase.auth.getSession(),
      SESSION_TIMEOUT_MS,
      "Auth check"
    );
    return data.session ?? null;
  } catch (err) {
    console.warn("[BleMap]", err.message);
    return null;
  }
}

async function enterAuthenticatedApp({ forceHome = false } = {}) {
  isAuthenticated = true;
  showAppOnly();
  updateAuthStatus();

  const hashRoute = window.location.hash ? parseRoute() : null;
  const stored = pendingReturnRoute;
  pendingReturnRoute = null;

  if (forceHome) {
    startAppRouter({ name: "home", params: {} });
  } else if (stored) {
    startAppRouter(stored);
  } else if (hashRoute && hashRoute.name !== "login" && hashRoute.name !== "register") {
    startAppRouter(hashRoute);
  } else {
    startAppRouter({ name: "home", params: {} });
  }

  await handleRouteChange(parseRoute());
}

function exitToAuth() {
  isAuthenticated = false;
  authMounted = false;
  viewCleanup?.();
  viewCleanup = null;
  clearRoute();
  showAuthOnly();
}

async function handleRouteChange(route) {
  const session = await requireSession();
  if (!session) {
    if (route.name !== "login" && route.name !== "register" && window.location.hash) {
      pendingReturnRoute = route;
    }
    exitToAuth();
    return;
  }

  if (!isAuthenticated) {
    enterAuthenticatedApp({ forceHome: false });
  } else {
    showAppOnly();
  }

  await renderRoute(route);
}

async function init() {
  onRouteChange(handleRouteChange);

  if (window.location.hash) {
    pendingReturnRoute = parseRoute();
  }
  clearRoute();
  exitToAuth();

  const session = await requireSession();

  if (session) {
    await enterAuthenticatedApp({ forceHome: !window.location.hash });
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) {
      if (!isAuthenticated) void enterAuthenticatedApp({ forceHome: false });
    } else {
      exitToAuth();
    }
  });

  window.addEventListener("blemap:authenticated", () => {
    void enterAuthenticatedApp({ forceHome: true });
  });

  document.getElementById("signout-btn")?.addEventListener("click", async () => {
    await supabase.auth.signOut();
    exitToAuth();
  });
}

function showFatalError(err) {
  console.error("[BleMap]", err);
  if (bootScreen) {
    bootScreen.style.display = "flex";
    if (authScreen) authScreen.style.display = "none";
    if (appShell) appShell.style.display = "none";
    bootScreen.innerHTML = `
      <p class="boot-title" style="color:#ffb779">BleMap</p>
      <p class="boot-sub" style="color:#e5e2e1;max-width:20rem;text-align:center;padding:0 1.5rem">Could not start the app. Hard refresh (Cmd+Shift+R).</p>
      <p class="boot-sub" style="font-size:0.75rem">${err?.message || "Unknown error"}</p>
    `;
  }
}

init()
  .then(() => {
    const errEl = document.getElementById("js-error");
    if (errEl) errEl.style.display = "none";
  })
  .catch((err) => {
    showFatalError(err);
    authView.wireAuthUi(authScreen);
    window.__blemapShowError?.(err?.message || "Failed to start");
  });
