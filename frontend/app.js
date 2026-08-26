import { supabase } from "./supabaseClient.js";
import { mountNav } from "./nav.js";
import { apiFetch } from "./api.js";
import {
  parseRoute,
  navigate,
  onRouteChange,
  startAppRouter,
  clearRoute,
  setPageTitle,
  isPublicAuthRoute,
  isCommunityRoute,
} from "./router.js";
import * as authView from "./views/authView.js";
import * as stewardAuthView from "./views/stewardAuthView.js";
import { startRealtime, stopRealtime } from "./lib/realtime.js";
import {
  captureRecoveryFromUrl,
  isPasswordRecoveryPending,
  clearPasswordRecovery,
} from "./lib/authSafety.js";

const bootScreen = document.getElementById("boot-screen");
const authScreen = document.getElementById("auth-screen");
const stewardAuthScreen = document.getElementById("steward-auth-screen");
const appShell = document.getElementById("app-shell");
const mainContent = document.getElementById("main-content");
const authStatus = document.getElementById("auth-status");
const adminBadge = document.getElementById("admin-badge");
const healthBadge = document.getElementById("health-badge");

let viewCleanup = null;
let authMounted = false;
let stewardAuthMounted = false;
let stewardAuthCleanup = null;
let isAuthenticated = false;
let isAdmin = false;
let pendingReturnRoute = null;

const VIEW_LOADERS = {
  home: () => import("./views/homeView.js"),
  submit: () => import("./views/submitView.js"),
  matrix: () => import("./views/matrixView.js"),
  prospector: () => import("./views/prospectorView.js"),
  admin: () => import("./views/adminView.js"),
  case: () => import("./views/caseView.js"),
};

function hideAllShells() {
  if (bootScreen) bootScreen.style.display = "none";
  if (authScreen) authScreen.style.display = "none";
  if (stewardAuthScreen) stewardAuthScreen.style.display = "none";
  if (appShell) appShell.style.display = "none";
}

function showBootOnly() {
  hideAllShells();
  if (bootScreen) bootScreen.style.display = "flex";
}

function showAuthOnly() {
  hideAllShells();
  if (authScreen) authScreen.style.display = "block";
  document.title = "Sign In · BleMap";
  stewardAuthCleanup?.();
  stewardAuthCleanup = null;
  stewardAuthMounted = false;

  if (!authMounted) {
    viewCleanup?.();
    viewCleanup = authView.mount(authScreen);
    authMounted = true;
  } else {
    authView.syncAuthPanel(parseRoute().name);
  }
}

function showStewardAuthOnly() {
  hideAllShells();
  if (stewardAuthScreen) stewardAuthScreen.style.display = "block";
  document.title = "Steward Sign-In · BleMap";
  setPageTitle("steward-login");
  authMounted = false;

  if (!stewardAuthMounted) {
    stewardAuthCleanup?.();
    stewardAuthCleanup = stewardAuthView.mount(stewardAuthScreen);
    stewardAuthMounted = true;
  }
}

function showAppOnly() {
  hideAllShells();
  if (appShell) appShell.style.display = "flex";
  authMounted = false;
  stewardAuthMounted = false;
  stewardAuthCleanup?.();
  stewardAuthCleanup = null;
}

function updateAdminBadge() {
  if (!adminBadge) return;
  adminBadge.classList.toggle("hidden", !isAdmin);
  adminBadge.setAttribute("aria-hidden", isAdmin ? "false" : "true");
}

async function updateAuthStatus() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (authStatus && user) {
    authStatus.textContent = `Signed in as ${user.email}`;
  }
  try {
    const me = await apiFetch("/me");
    isAdmin = Boolean(me?.isAdmin);
  } catch {
    isAdmin = false;
  }
  updateAdminBadge();
}

async function updateHealthBadge() {
  if (!healthBadge) return;
  try {
    const res = await fetch("/health");
    const h = await res.json();
    const store = h.store || "?";
    const sb = h.supabase?.configured ? "supabase" : "no-auth-cfg";
    const gem = h.gemini?.status || (h.gemini?.configured ? "gemini" : "no-gemini");
    healthBadge.textContent = `${store} · ${sb}`;
    healthBadge.title = `store=${store}; supabase.configured=${h.supabase?.configured}; gemini=${gem}; ok=${h.ok}`;
    healthBadge.dataset.ok = h.ok ? "1" : "0";
    healthBadge.classList.toggle("health-badge--warn", !h.ok || store === "memory");
  } catch {
    healthBadge.textContent = "health offline";
    healthBadge.dataset.ok = "0";
    healthBadge.classList.add("health-badge--warn");
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

  if (route.name === "forgot-password" || route.name === "reset-password") {
    showAuthOnly();
    authView.syncAuthPanel(route.name);
    return;
  }

  if (route.name === "steward-login") {
    if (isAdmin) {
      navigate("admin");
      return;
    }
    // Non-steward community session should not land on the desk
    navigate("home");
    return;
  }

  if (route.name === "admin" && !isAdmin) {
    navigate("home");
    return;
  }

  // Stewards use an ops desk — not the community matrix / submit flows
  if (isAdmin && isCommunityRoute(route.name)) {
    navigate("admin");
    return;
  }

  setPageTitle(route.name);
  viewCleanup?.();
  viewCleanup = null;

  mountNav(
    "app-nav",
    route.name === "case" ? "admin" : route.name,
    {
      isAdmin,
      section: route.params?.section || "queue",
    }
  );

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
    } else if (route.name === "admin") {
      viewCleanup = await view.mount(mainContent, {
        section: route.params?.section || "queue",
      });
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

let stopRealtimeFn = null;

async function enterAuthenticatedApp({
  forceHome = false,
  forceAdmin = false,
} = {}) {
  if (isPasswordRecoveryPending()) {
    showAuthOnly();
    authView.syncAuthPanel("reset-password");
    return;
  }
  isAuthenticated = true;
  showAppOnly();
  await updateAuthStatus();
  updateHealthBadge();
  stopRealtimeFn?.();
  stopRealtimeFn = startRealtime();

  const hashRoute = window.location.hash ? parseRoute() : null;
  const stored = pendingReturnRoute;
  pendingReturnRoute = null;

  if (isAdmin) {
    const section =
      hashRoute?.name === "admin" ? hashRoute.params?.section : undefined;
    startAppRouter({
      name: "admin",
      params: section ? { section } : {},
    });
  } else if (forceHome) {
    startAppRouter({ name: "home", params: {} });
  } else if (stored && stored.name !== "steward-login") {
    startAppRouter(stored);
  } else if (
    hashRoute &&
    !isPublicAuthRoute(hashRoute.name) &&
    hashRoute.name !== "steward-login"
  ) {
    startAppRouter(hashRoute);
  } else {
    startAppRouter({ name: "home", params: {} });
  }

  await handleRouteChange(parseRoute());
}

function exitToAuth({ steward = false } = {}) {
  isAuthenticated = false;
  isAdmin = false;
  updateAdminBadge();
  authMounted = false;
  stopRealtime();
  stopRealtimeFn = null;
  viewCleanup?.();
  viewCleanup = null;

  if (steward) {
    navigate("steward-login");
    showStewardAuthOnly();
    return;
  }

  clearRoute();
  showAuthOnly();
}

async function handleRouteChange(route) {
  if (route.name === "steward-login") {
    const session = await requireSession();
    if (session) {
      await updateAuthStatus();
      if (isAdmin) {
        await enterAuthenticatedApp({ forceAdmin: true });
        return;
      }
      // Clear non-steward session so the desk login is exclusive
      await supabase.auth.signOut();
    }
    showStewardAuthOnly();
    return;
  }

  if (
    route.name === "login" ||
    route.name === "register" ||
    route.name === "forgot-password" ||
    route.name === "reset-password"
  ) {
    const recovery = isPasswordRecoveryPending() || route.name === "reset-password";
    if (recovery) {
      showAuthOnly();
      authView.syncAuthPanel("reset-password");
      return;
    }
    const session = await requireSession();
    if (session && route.name !== "forgot-password") {
      await enterAuthenticatedApp({ forceHome: true });
      return;
    }
    showAuthOnly();
    authView.syncAuthPanel(route.name);
    return;
  }

  const session = await requireSession();
  if (!session) {
    if (window.location.hash && !isPublicAuthRoute(route.name)) {
      pendingReturnRoute = route;
    }
    if (route.name === "admin") {
      exitToAuth({ steward: true });
      return;
    }
    exitToAuth();
    return;
  }

  if (!isAuthenticated) {
    await enterAuthenticatedApp({ forceHome: false });
    return;
  }

  showAppOnly();
  await renderRoute(route);
}

async function init() {
  captureRecoveryFromUrl();
  onRouteChange(handleRouteChange);

  const initial = parseRoute();
  const openSteward = initial.name === "steward-login";
  const recovery = isPasswordRecoveryPending() || initial.name === "reset-password";

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      try {
        sessionStorage.setItem("blemap-password-recovery", "1");
      } catch {
        /* ignore */
      }
      showAuthOnly();
      authView.syncAuthPanel("reset-password");
      return;
    }
    if (session) {
      if (isPasswordRecoveryPending()) return;
      if (!isAuthenticated) {
        const stewardIntent =
          parseRoute().name === "steward-login" ||
          document.getElementById("steward-auth-screen")?.style.display ===
            "block";
        void enterAuthenticatedApp({
          forceHome: !stewardIntent,
          forceAdmin: stewardIntent,
        });
      }
    } else if (isAuthenticated) {
      const steward =
        parseRoute().name === "steward-login" ||
        parseRoute().name === "admin";
      exitToAuth({ steward });
    }
  });

  if (recovery) {
    showAuthOnly();
    authView.syncAuthPanel("reset-password");
    if (window.location.hash.includes("access_token")) {
      history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}#/reset-password`
      );
    }
  } else if (openSteward) {
    if (window.location.hash && !isPublicAuthRoute(initial.name)) {
      pendingReturnRoute = initial;
    }
    showStewardAuthOnly();
  } else {
    if (window.location.hash && !isPublicAuthRoute(initial.name)) {
      pendingReturnRoute = initial;
    }
    if (!window.location.hash.includes("access_token")) {
      clearRoute();
    }
    showAuthOnly();
  }

  if (recovery) {
    window.addEventListener("blemap:authenticated", () => {
      clearPasswordRecovery();
      void enterAuthenticatedApp({ forceHome: true });
    });
    window.addEventListener("blemap:steward-authenticated", () => {
      clearPasswordRecovery();
      void enterAuthenticatedApp({ forceAdmin: true });
    });
    document.getElementById("signout-btn")?.addEventListener("click", async () => {
      const wasAdminDesk = parseRoute().name === "admin";
      await supabase.auth.signOut();
      exitToAuth({ steward: wasAdminDesk });
    });
    return;
  }

  const session = await requireSession();

  if (isPasswordRecoveryPending()) {
    showAuthOnly();
    authView.syncAuthPanel("reset-password");
  } else if (session) {
    if (openSteward) {
      await updateAuthStatus();
      if (isAdmin) {
        await enterAuthenticatedApp({ forceAdmin: true });
      } else {
        showStewardAuthOnly();
      }
    } else {
      await enterAuthenticatedApp({ forceHome: !window.location.hash });
    }
  }

  window.addEventListener("blemap:authenticated", () => {
    clearPasswordRecovery();
    void enterAuthenticatedApp({ forceHome: true });
  });

  window.addEventListener("blemap:steward-authenticated", () => {
    clearPasswordRecovery();
    void enterAuthenticatedApp({ forceAdmin: true });
  });

  document.getElementById("signout-btn")?.addEventListener("click", async () => {
    const wasAdminDesk = parseRoute().name === "admin";
    await supabase.auth.signOut();
    exitToAuth({ steward: wasAdminDesk });
  });

  window.addEventListener("hashchange", () => {
    if (
      !isAuthenticated &&
      parseRoute().name === "steward-login" &&
      stewardAuthScreen?.style.display !== "block"
    ) {
      showStewardAuthOnly();
    }
  });
}

function showFatalError(err) {
  console.error("[BleMap]", err);
  if (bootScreen) {
    showBootOnly();
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
