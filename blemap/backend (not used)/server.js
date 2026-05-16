import dotenv from "dotenv";
import path from "path";
import express from "express";
import { errorHandler, notFound } from "./middleware (not used)/errorHandler.js";

dotenv.config();

const app = express();
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(process.cwd(), "frontend")));

// 404 handler
app.use(notFound);

// Global error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

