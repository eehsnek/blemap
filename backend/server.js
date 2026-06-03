import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import apiRouter from "./routes/api.js";
import { getStore } from "./store/index.js";
import { resolvePublicSupabaseConfig } from "./config/supabasePublic.js";

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
  const { url: supabaseUrl, anonKey: supabaseAnonKey } =
    resolvePublicSupabaseConfig();

  res.type("application/javascript").send(
    `window.__BLEMAP_CONFIG = ${JSON.stringify({
      apiBase: "",
      supabaseUrl,
      supabaseAnonKey,
    })};`
  );
});

app.use("/api", apiRouter);

app.get("/", (_req, res) => res.redirect("/frontend/app.html"));
app.get("/frontend/home.html", (_req, res) => res.redirect("/frontend/app.html#/home"));
app.get("/frontend/caseMatrix.html", (_req, res) => res.redirect("/frontend/app.html#/matrix"));
app.get("/frontend/input.html", (_req, res) => res.redirect("/frontend/app.html#/submit"));
app.get("/frontend/prospector.html", (_req, res) => res.redirect("/frontend/app.html#/prospector"));
app.get("/frontend/register.html", (_req, res) => res.redirect("/frontend/app.html"));
app.get("/frontend/caseDetail.html", (req, res) => {
  const id = req.query.id;
  res.redirect(id ? `/frontend/app.html#/case/${id}` : "/frontend/app.html#/home");
});

app.use("/shared", express.static(path.join(rootDir, "shared")));
app.use("/vendor", express.static(path.join(rootDir, "node_modules")));
app.use(
  "/frontend",
  express.static(frontendDir, {
    setHeaders(res, filePath) {
      if (filePath.endsWith(".js") || filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-store");
      }
    },
  })
);
app.use(express.static(frontendDir));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal server error" });
});

if (!process.env.VERCEL) {
  const server = app.listen(port, () => {
    console.log(`BleMap server http://localhost:${port}`);
    console.log(`  App:         http://localhost:${port}/frontend/app.html`);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `\nPort ${port} is already in use. Run: npm run predev\nOr stop all dev servers and run only one: npm run dev\n`
      );
      process.exit(1);
    }
    throw err;
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

export default app;
