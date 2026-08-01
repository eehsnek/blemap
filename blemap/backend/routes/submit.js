import express from "express";
import { submitCase } from "../controllers/submitController.js";

const router = express.Router();

router.post("/", submitCase);

export default router;