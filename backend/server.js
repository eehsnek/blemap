import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import apiRouter from "./routes/api.js";
import { getStore } from "./store/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const frontendDir = path.join(rootDir, "frontend");

const app = express();
const port = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, store: getStore().mode });
});

app.get("/config.js", (_req, res) => {
  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    "";
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    "";

  res.type("application/javascript").send(
    `window.__BLEMAP_CONFIG = ${JSON.stringify({
      apiBase: "",
      supabaseUrl,
      supabaseAnonKey,
    })};`
  );
});

app.use("/api", apiRouter);
app.use("/frontend", express.static(frontendDir));
app.use(express.static(frontendDir));

app.get("/", (_req, res) => {
  res.redirect("/frontend/index.html");
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

app.listen(port, () => {
  console.log(`BleMap server http://localhost:${port}`);
  console.log(`  Login:  http://localhost:${port}/frontend/index.html`);
  console.log(`  Matrix: http://localhost:${port}/frontend/caseMatrix.html`);
});
