#!/usr/bin/env node
/**
 * Run the scrape pipeline locally (direct store call — no HTTP auth needed).
 * Usage: npm run scrape
 */
import "dotenv/config";
import { getStore } from "../backend/store/index.js";

const store = getStore();
if (!store.runScrapePipeline) {
  console.error("Scraper not available for this store");
  process.exit(1);
}

const result = await store.runScrapePipeline();
if (result?.error) {
  console.error("Scrape failed:", result.status ?? 503, result.error);
  process.exit(1);
}

console.log("Scrape complete:", JSON.stringify(result, null, 2));
