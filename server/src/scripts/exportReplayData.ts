// Export every cached ReplayData row to its own JSON file: <dir>/YYYY-MM-DD.json
//
// Usage (from server/):
//   npm run export:replay                              → REPLAY_EXPORT_DIR, default exports/replay
//   npm run export:replay -- D:\data\replay            → explicit folder (overrides REPLAY_EXPORT_DIR)
//   npm run export:replay -- --overwrite [folder]      → replace files that already exist
//
// Existing files are skipped unless --overwrite (or --overwrite=true) is given.
// Same export as POST /api/replay/export (see services/replayExport.ts).

import { config } from "../config.js";
import prisma from "../db/client.js";
import { exportReplayData } from "../services/replayExport.js";

function parseArgs(argv: string[]): { dir: string; overwrite: boolean } {
  let dir: string | undefined;
  let overwrite = false;
  for (const arg of argv) {
    const flag = /^--overwrite(?:=(true|false))?$/i.exec(arg);
    if (flag) overwrite = (flag[1] ?? "true").toLowerCase() === "true";
    else if (arg.startsWith("--")) throw new Error(`Unknown option: ${arg} (supported: --overwrite[=true|false])`);
    else if (dir === undefined) dir = arg;
    else throw new Error(`Unexpected argument: ${arg} (only one output folder allowed)`);
  }
  return { dir: dir ?? config.replayExportDir, overwrite };
}

async function main(): Promise<void> {
  const { dir, overwrite } = parseArgs(process.argv.slice(2));
  const { dir: outDir, written, skipped } = await exportReplayData(dir, overwrite);

  if (written.length === 0 && skipped.length === 0) {
    console.log("No cached replay data to export.");
    return;
  }
  for (const date of written) console.log(`  ${date}.json`);
  console.log(
    `Exported ${written.length} day(s) to ${outDir}` +
    (skipped.length > 0 ? ` — skipped ${skipped.length} existing file(s) (use --overwrite to replace)` : "")
  );
}

main()
  .catch((err) => {
    console.error("[export:replay] failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
