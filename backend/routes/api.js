import { Router } from "express";
import { getStore } from "../store/index.js";

const router = Router();

function sendStoreError(res, result) {
  if (result?.error) {
    return res.status(result.status ?? 400).json({ error: result.error });
  }
  return null;
}

router.get("/test", async (_req, res, next) => {
  try {
    const data = await getStore().getPrecaseFeed();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get("/cases", async (req, res, next) => {
  try {
    const userId = req.query.user_id ?? null;
    const cases = await getStore().listCases(userId);
    res.json(cases);
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

router.post("/submit", async (req, res, next) => {
  try {
    const text = req.body?.text?.trim();
    if (!text) return res.status(400).json({ error: "text is required" });
    const result = await getStore().submitCase({ text });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/cases/:id/pain", async (req, res, next) => {
  try {
    const userId = req.body?.user_id;
    if (!userId) return res.status(400).json({ error: "user_id is required" });
    const result = await getStore().togglePain(req.params.id, userId);
    if (sendStoreError(res, result)) return;
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/cases/:id/toggle-claim", async (req, res, next) => {
  try {
    const userId = req.body?.user_id;
    if (!userId) return res.status(400).json({ error: "user_id is required" });
    const result = await getStore().toggleClaim(req.params.id, userId);
    if (sendStoreError(res, result)) return;
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/cases/:id/solve", async (req, res, next) => {
  try {
    const userId = req.body?.user_id;
    const solveText = req.body?.solve_text?.trim();
    if (!userId || !solveText) {
      return res.status(400).json({ error: "user_id and solve_text are required" });
    }
    const result = await getStore().addSolve(req.params.id, userId, solveText);
    if (sendStoreError(res, result)) return;
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/solves/:id/accept", async (req, res, next) => {
  try {
    const userId = req.body?.user_id;
    if (!userId) return res.status(400).json({ error: "user_id is required" });
    const result = await getStore().acceptSolve(req.params.id, userId);
    if (sendStoreError(res, result)) return;
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/solves/:id/unaccept", async (req, res, next) => {
  try {
    const userId = req.body?.user_id;
    if (!userId) return res.status(400).json({ error: "user_id is required" });
    const result = await getStore().unacceptSolve(req.params.id, userId);
    if (sendStoreError(res, result)) return;
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
