import { execSync } from "node:child_process";

const port = process.argv[2] || process.env.PORT || "4000";

try {
  const pids = execSync(`lsof -ti :${port}`, { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean);
  for (const pid of pids) {
    try {
      process.kill(Number(pid), "SIGKILL");
    } catch {
      /* already gone */
    }
  }
  if (pids.length) {
    console.log(`Freed port ${port} (stopped ${pids.length} process(es))`);
  }
} catch {
  /* port already free */
}
