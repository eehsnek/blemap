import { Router } from "express";
import { getStore } from "../store/index.js";
import { optionalAuth, requireAuth, getUserId } from "../middleware/auth.js";

const router = Router();
router.use(optionalAuth);

function sendStoreError(res, result) {
  if (result?.error) {
    return res.status(result.status ?? 400).json({ error: result.error });
  }
  return null;
}

router.get("/test", async (_req, res, next) => {
  try {
    res.json(await getStore().getPrecaseFeed());
  } catch (err) {
    next(err);
  }
});

router.post("/scrape/run", async (_req, res, next) => {
  try {
    const store = getStore();
    if (!store.runScrapePipeline) {
      return res.status(501).json({ error: "Scraper not available for this store" });
    }
    res.json(await store.runScrapePipeline());
  } catch (err) {
    next(err);
  }
});

router.get("/cases", async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const view = req.query.view;

    if (view === "matrix") {
      return res.json(await getStore().listMatrixCases(userId));
    }
    if (view === "prospector") {
      return res.json(await getStore().listProspectorCases(userId));
    }
    if (view === "pending") {
      const all = await getStore().listCases(userId);
      return res.json(all.filter((c) => c.status === "pending"));
    }

    res.json(await getStore().listCases(userId));
  } catch (err) {
    next(err);
  }
});

router.get("/cases/:id", async (req, res, next) => {
  try {
    const c = await getStore().getCase(req.params.id);
    if (!c) return res.status(404).json({ error: "Case not found" });
    res.json(c);
  } catch (err) {
    next(err);
  }
});

router.post("/submit/analyze", async (req, res, next) => {
  try {
    const text = req.body?.text?.trim();
    if (!text) return res.status(400).json({ error: "text is required" });
    const store = getStore();
    if (!store.analyzeSubmit) {
      return res.status(501).json({ error: "Analyze flow not supported" });
    }
    res.json(await store.analyzeSubmit({ text, userId: getUserId(req) }));
  } catch (err) {
    next(err);
  }
});

router.post("/submit/confirm", requireAuth, async (req, res, next) => {
  try {
    const { draftId, mergeIntoCaseId } = req.body ?? {};
    if (!draftId) return res.status(400).json({ error: "draftId is required" });
    const result = await getStore().confirmSubmit({
      draftId,
      userId: getUserId(req),
      mergeIntoCaseId,
    });
    if (sendStoreError(res, result)) return;
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** @deprecated — prefer analyze + confirm */
router.post("/submit", async (req, res, next) => {
  try {
    const text = req.body?.text?.trim();
    if (!text) return res.status(400).json({ error: "text is required" });
    const result = await getStore().submitCase({ text });
    if (sendStoreError(res, result)) return;
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/cases/:id/confirm", requireAuth, async (req, res, next) => {
  try {
    const result = await getStore().confirmCase(req.params.id, getUserId(req));
    if (sendStoreError(res, result)) return;
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/cases/:id/pain", requireAuth, async (req, res, next) => {
  try {
    const result = await getStore().togglePain(req.params.id, getUserId(req));
    if (sendStoreError(res, result)) return;
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/cases/:id/toggle-claim", requireAuth, async (req, res, next) => {
  try {
    const result = await getStore().toggleClaim(req.params.id, getUserId(req));
    if (sendStoreError(res, result)) return;
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/cases/:id/solve", requireAuth, async (req, res, next) => {
  try {
    const solveText = req.body?.solve_text?.trim();
    if (!solveText) {
      return res.status(400).json({ error: "solve_text is required" });
    }
    const result = await getStore().addSolve(
      req.params.id,
      getUserId(req),
      solveText
    );
    if (sendStoreError(res, result)) return;
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/cases/:id/solved", requireAuth, async (req, res, next) => {
  try {
    const store = getStore();
    if (!store.markSolved) {
      return res.status(501).json({ error: "Not supported" });
    }
    const result = await store.markSolved(
      req.params.id,
      getUserId(req),
      req.body?.outcome_url,
      req.body?.outcome_note
    );
    if (sendStoreError(res, result)) return;
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/solves/:id/accept", requireAuth, async (req, res, next) => {
  try {
    const result = await getStore().acceptSolve(req.params.id, getUserId(req));
    if (sendStoreError(res, result)) return;
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/solves/:id/unaccept", requireAuth, async (req, res, next) => {
  try {
    const result = await getStore().unacceptSolve(req.params.id, getUserId(req));
    if (sendStoreError(res, result)) return;
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
