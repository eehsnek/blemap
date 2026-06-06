#!/usr/bin/env node
/**
 * Trigger the scrape pipeline locally.
 * Usage: npm run scrape
 * Requires server on PORT (default 4000) and CRON_SECRET in .env if set.
 */
import "dotenv/config";

const port = process.env.PORT || 4000;
const secret = process.env.CRON_SECRET?.trim();
const base = `http://127.0.0.1:${port}`;

const headers = { "Content-Type": "application/json" };
if (secret) {
  headers.Authorization = `Bearer ${secret}`;
}

const res = await fetch(`${base}/api/scrape/run`, {
  method: "POST",
  headers,
  body: "{}",
});

const text = await res.text();
let body;
try {
  body = JSON.parse(text);
} catch {
  body = text;
}

if (!res.ok) {
  console.error("Scrape failed:", res.status, body);
  process.exit(1);
}

console.log("Scrape complete:", JSON.stringify(body, null, 2));
