import express from "express";
import { getCaseById,
  assignPrecaseToCase,
  getCases,
  toggleCaseClaim,
  toggleCasePain,
  submitCaseSolve,
  acceptCaseSolve,
  unacceptCaseSolve,
  generateUserProfileReport
 } from "../services/caseService.js";

 import { rebuildCases } from "../services/caseRebuildService.js";

const router = express.Router();

router.get("/cases/rebuild", async (req, res) => {
  try {
    const result = await rebuildCases();

    res.json({
      status: "ok",
      clusters_created: result.clustersCreated
    });
  } catch (err) {
    console.error("Rebuild error:", err);

    res.status(500).json({
      error: err.message
    });
  }
});

router.get("/cases/:id", async (req, res) => {
  try {
    const caseData = await getCaseById(req.params.id);

    res.json(caseData);
  } catch (err) {
    console.error("Error fetching case:", err);

    if (err.message.startsWith("CASE_NOT_FOUND:")) {
      return res.status(404).json({
        error: err.message.replace("CASE_NOT_FOUND: ", "")
      });
    }

    res.status(500).json({
      error: err.message
    });
  }
});

router.get("/cases/assign/:precaseId", async (req, res) => {
  try {
    const result = await assignPrecaseToCase(req.params.precaseId);

    res.json(result);
  } catch (err) {
    console.error("assign-case error:", err);

    if (err.code === "PRECASE_NOT_FOUND") {
      return res.status(404).json({ error: err.message });
    }

    if (err.code === "NO_EMBEDDING") {
      return res.status(400).json({ error: err.message });
    }

    res.status(500).json({ error: err.message });
  }
});

router.get("/cases", async (req, res) => {
  const userId = req.query.user_id;

  try {
    const cases = await getCases(userId);

    res.json(cases);
  } catch (err) {
    console.error("Get cases error:", err);

    res.status(500).json({
      error: err.message
    });
  }
});

router.post("/cases/:id/toggle-claim", async (req, res) => {
  console.log("🔥 TOGGLE CLAIM ROUTE HIT");
  console.log("Case ID:", req.params.id);
  console.log("Body:", req.body);

  const caseId = req.params.id;
  const userId = req.body.user_id;

  if (!userId) {
    return res.status(400).json({
      error: "user_id is required"
    });
  }

  try {
    const result = await toggleCaseClaim(caseId, userId);

    res.json(result);
  } catch (err) {
    console.error("Toggle claim error:", err);

    res.status(500).json({
      error: err.message
    });
  }
});

router.post("/cases/:id/pain", async (req, res) => {
  const caseId = req.params.id;
  const userId = req.body.user_id;

  if (!userId) {
    return res.status(400).json({
      error: "user_id is required"
    });
  }

  try {
    const result = await toggleCasePain(caseId, userId);

    res.json(result);
  } catch (err) {
    console.error("Toggle pain error:", err);

    res.status(500).json({
      error: err.message
    });
  }
});

router.post("/cases/:id/solve", async (req, res) => {
  const caseId = req.params.id;
  const userId = req.body.user_id;
  const { solve_text } = req.body;

  if (!userId || !solve_text) {
    return res.status(400).json({
      error: "user_id and solve_text are required"
    });
  }

  try {
    const result = await submitCaseSolve(
      caseId,
      userId,
      solve_text
    );

    res.json(result);
  } catch (err) {
    console.error("Submit solve error:", err);

    res.status(500).json({
      error: err.message
    });
  }
});

router.post("/solves/:id/accept", async (req, res) => {
  const solveId = req.params.id;
  const userId = req.body.user_id;

  if (!userId) {
    return res.status(400).json({
      error: "user_id is required"
    });
  }

  try {
    const result = await acceptCaseSolve(
      solveId,
      userId
    );

    res.json(result);
  } catch (err) {
    console.error("Accept solution error:", err);

    if (err.code === "FORBIDDEN") {
      return res.status(403).json({
        error: err.message
      });
    }

    res.status(500).json({
      error: err.message
    });
  }
});

router.post("/solves/:id/unaccept", async (req, res) => {
  const solveId = req.params.id;
  const userId = req.body.user_id;

  if (!userId) {
    return res.status(400).json({
      error: "user_id is required"
    });
  }

  try {
    const result = await unacceptCaseSolve(
      solveId,
      userId
    );

    res.json(result);
  } catch (err) {
    console.error("Unaccept solution error:", err);

    if (err.code === "FORBIDDEN") {
      return res.status(403).json({
        error: err.message
      });
    }

    res.status(500).json({
      error: err.message
    });
  }
});

router.get("/users/:id/profile-report", async (req, res) => {
  const userId = req.params.id;

  try {
    const report = await generateUserProfileReport(userId);

    res.json(report);
  } catch (err) {
    console.error("Profile report error:", err);

    if (err.code === "NOT_FOUND") {
      return res.status(404).json({
        error: err.message
      });
    }

    res.status(500).json({
      error: err.message
    });
  }
});

export default router;