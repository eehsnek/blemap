import express from "express";
import { 
    fetchHackerNewsPosts, getPrecases, clusterCases
} from "../services/ingestionService.js";

const router = express.Router();

router.get("/post", async (req, res) => {
  try {
    const data = await fetchHackerNewsPosts();

    res.json({ 
        inserted: data 
    });
  } catch (err) {
    console.error("Hacker News ingestion error:", err);

    res.status(500).json({
      error: err.message
    });
  }
});

router.get("/get", async (req, res) => {
  try {
    const data = await getPrecases();

    res.json({
      posts: data
    });
  } catch (err) {
    console.error("Get precases error:", err);

    res.status(500).json({
      error: err.message
    });
  }
});

router.get("/cluster-cases", async (req, res) => {
  try {
    const result = await clusterCases();

    res.json(result);
  } catch (err) {
    console.error("Cluster-cases error:", err);

    res.status(500).json({
      error: err.message
    });
  }
});

export default router;