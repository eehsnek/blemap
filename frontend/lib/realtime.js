import { supabase } from "../supabaseClient.js";
import { emitDataChanged } from "./events.js";

let channel = null;

function storeMode() {
  return window.__BLEMAP_CONFIG?.store ?? "memory";
}

export function startRealtime() {
  if (storeMode() !== "supabase") return () => {};
  if (channel) return stopRealtime;

  channel = supabase
    .channel("blemap-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "cases" },
      () => emitDataChanged("realtime")
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "case_events" },
      () => emitDataChanged("realtime")
    )
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "scrape_runs" },
      () => emitDataChanged("realtime")
    )
    .subscribe();

  return stopRealtime;
}

export function stopRealtime() {
  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
}
