import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import apiRouter from "./routes/api.js";
import { getStore } from "./store/index.js";
import { resolvePublicSupabaseConfig } from "./config/supabasePublic.js";
import {
  buildHealthReport,
  logGeminiStartupGuard,
} from "./lib/healthChecks.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const frontendDir = path.join(rootDir, "frontend");

const app = express();
const port = Number(process.env.PORT) || 4000;

app.use(cors());
app.use(express.json());

app.get("/health", async (req, res, next) => {
  try {
    const deep = req.query.deep === "1" || req.query.deep === "true";
    const report = await buildHealthReport({ deep });
    res.status(report.ok ? 200 : 503).json(report);
  } catch (err) {
    next(err);
  }
});

app.get("/config.js", (_req, res) => {
  const { url: supabaseUrl, anonKey: supabaseAnonKey, configured } =
    resolvePublicSupabaseConfig();

  res.type("application/javascript").send(
    `window.__BLEMAP_CONFIG = ${JSON.stringify({
      apiBase: "",
      supabaseUrl,
      supabaseAnonKey,
      supabaseConfigured: configured,
      store: getStore().mode,
    })};`
  );
});

app.use("/api", apiRouter);

app.get("/", (_req, res) => res.redirect("/frontend/app.html"));
app.get("/steward", (_req, res) =>
  res.redirect("/frontend/app.html#/steward-login")
);
app.get("/forgot-password", (_req, res) =>
  res.redirect("/frontend/app.html#/forgot-password")
);
app.get("/reset-password", (_req, res) =>
  res.redirect("/frontend/app.html#/reset-password")
);
app.get("/admin", (_req, res) =>
  res.redirect("/frontend/app.html#/steward-login")
);
app.get("/admin/login", (_req, res) =>
  res.redirect("/frontend/app.html#/steward-login")
);
app.get("/frontend/index.html", (_req, res) => res.redirect("/frontend/app.html"));
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
  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`BleMap server http://localhost:${port}`);
    console.log(`  App:         http://localhost:${port}/frontend/app.html`);
    logGeminiStartupGuard().catch((err) => {
      console.error("[gemini] startup guard error:", err.message || err);
    });
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
