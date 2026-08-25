import express from "express";
import { getAllPrecases } from "../repositories/precaseRepository.js";

const router = express.Router();

router.get("/precases", async (req, res) => {
  try {
    const precases = await getAllPrecases();

    res.json(precases);
  } catch (err) {
    console.error("Get precases error:", err);

    res.status(500).json({
      error: err.message
    });
  }
});

export default router;