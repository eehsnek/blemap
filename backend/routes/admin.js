import { Router } from "express";
import { getStore } from "../store/index.js";
import { getUserId, requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import {
  filterCases,
  normalizeAdminReason,
  searchCases,
  sortCases,
  summarizeCases,
} from "../lib/adminCases.js";

const router = Router();

function sendStoreError(res, result) {
  if (result?.error) {
    return res.status(result.status ?? 400).json({ error: result.error });
  }
  return null;
}

function reasonFrom(req) {
  return normalizeAdminReason(req.body?.reason);
}

router.use(requireAuth, requireAdmin);

router.get("/cases", async (req, res, next) => {
  try {
    const store = getStore();
    if (!store.adminListModeration) {
      return res.status(501).json({ error: "Admin list not available" });
    }
    const cases = await store.adminListModeration(getUserId(req));
    const filter = String(req.query.filter || "all").toLowerCase();
    const q = String(req.query.q || "");
    const sort = String(req.query.sort || "priority").toLowerCase();
    const filtered = sortCases(searchCases(filterCases(cases, filter), q), sort);
    res.json({
      cases: filtered,
      summary: summarizeCases(cases),
      filter,
      q,
      sort,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/precase", async (req, res, next) => {
  try {
    const store = getStore();
    if (!store.getPrecaseFeed) {
      return res.json({ inserted: [] });
    }
    res.json(await store.getPrecaseFeed());
  } catch (err) {
    next(err);
  }
});

router.get("/cases/:id/events", async (req, res, next) => {
  try {
    const store = getStore();
    if (!store.getCaseEvents) {
      return res.json([]);
    }
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    res.json(await store.getCaseEvents(req.params.id, limit));
  } catch (err) {
    next(err);
  }
});

router.post("/cases/bulk", async (req, res, next) => {
  try {
    const action = String(req.body?.action || "").toLowerCase();
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.map((id) => String(id)).filter(Boolean)
      : [];
    if (!ids.length) {
      return res.status(400).json({ error: "ids required" });
    }
    if (!["publish", "hide", "restore"].includes(action)) {
      return res
        .status(400)
        .json({ error: "action must be publish, hide, or restore" });
    }
    const store = getStore();
    const actorId = getUserId(req);
    const reason = reasonFrom(req);
    const results = [];
    for (const id of ids.slice(0, 40)) {
      const fn =
        action === "publish"
          ? store.adminPublish
          : action === "hide"
            ? store.adminHide
            : store.adminRestore;
      const result = await fn.call(store, id, actorId, reason);
      results.push({
        id,
        ok: !result?.error,
        error: result?.error || null,
      });
    }
    res.json({
      action,
      ok: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/cases/:id/publish", async (req, res, next) => {
  try {
    const result = await getStore().adminPublish(
      req.params.id,
      getUserId(req),
      reasonFrom(req)
    );
    if (sendStoreError(res, result)) return;
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/cases/:id/hide", async (req, res, next) => {
  try {
    const result = await getStore().adminHide(
      req.params.id,
      getUserId(req),
      reasonFrom(req)
    );
    if (sendStoreError(res, result)) return;
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/cases/:id/restore", async (req, res, next) => {
  try {
    const result = await getStore().adminRestore(
      req.params.id,
      getUserId(req),
      reasonFrom(req)
    );
    if (sendStoreError(res, result)) return;
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/cases/:id/unclaim", async (req, res, next) => {
  try {
    const result = await getStore().adminUnclaim(
      req.params.id,
      getUserId(req),
      reasonFrom(req)
    );
    if (sendStoreError(res, result)) return;
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.patch("/cases/:id", async (req, res, next) => {
  try {
    const result = await getStore().adminPatch(
      req.params.id,
      getUserId(req),
      req.body || {},
      reasonFrom(req)
    );
    if (sendStoreError(res, result)) return;
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/cases/:id/merge", async (req, res, next) => {
  try {
    const intoId = String(req.body?.intoCaseId || "").trim();
    if (!intoId) {
      return res.status(400).json({ error: "intoCaseId required" });
    }
    const result = await getStore().adminMerge(
      req.params.id,
      intoId,
      getUserId(req),
      reasonFrom(req)
    );
    if (sendStoreError(res, result)) return;
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/solves/:id/unaccept", async (req, res, next) => {
  try {
    const result = await getStore().adminUnacceptSolve(
      req.params.id,
      getUserId(req),
      reasonFrom(req)
    );
    if (sendStoreError(res, result)) return;
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/cases/:id/flag", async (req, res, next) => {
  try {
    const result = await getStore().adminFlag(
      req.params.id,
      getUserId(req),
      reasonFrom(req)
    );
    if (sendStoreError(res, result)) return;
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/cases/:id/unflag", async (req, res, next) => {
  try {
    const result = await getStore().adminUnflag(
      req.params.id,
      getUserId(req),
      reasonFrom(req)
    );
    if (sendStoreError(res, result)) return;
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/users", async (req, res, next) => {
  try {
    const { listStewardUsers } = await import("../lib/adminUsers.js");
    const result = await listStewardUsers();
    if (sendStoreError(res, result)) return;
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/users/:id/role", async (req, res, next) => {
  try {
    const { setUserRole } = await import("../lib/adminUsers.js");
    const result = await setUserRole(
      req.params.id,
      req.body?.role,
      getUserId(req)
    );
    if (sendStoreError(res, result)) return;
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/users/:id/disable", async (req, res, next) => {
  try {
    const { setUserDisabled } = await import("../lib/adminUsers.js");
    const result = await setUserDisabled(
      req.params.id,
      Boolean(req.body?.disabled),
      getUserId(req)
    );
    if (sendStoreError(res, result)) return;
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/scrape", async (req, res, next) => {
  try {
    const store = getStore();
    const [status, feed] = await Promise.all([
      store.getIngestionStatus?.() ?? { lastRun: null },
      store.getPrecaseFeed?.() ?? { inserted: [] },
    ]);
    res.json({
      ...status,
      precase: feed.inserted || [],
      publishMode: (await import("../ingestion/config.js")).scrapePublishMode(),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/scrape/run", async (req, res, next) => {
  try {
    const store = getStore();
    if (!store.runScrapePipeline) {
      return res.status(501).json({ error: "Scraper not available" });
    }
    const result = await store.runScrapePipeline();
    if (result?.error) {
      return res.status(result.status ?? 503).json({ error: result.error });
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
