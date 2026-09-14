import { mkdir, writeFile } from "fs/promises";
import { join, resolve } from "path";
import { listAllReplayData } from "../db/replayDataRepository.js";

export interface ReplayExportResult {
  dir:     string    // absolute output folder
  written: string[]  // dates written, oldest first
  skipped: string[]  // dates skipped because the file already existed
}

/**
 * Write every cached ReplayData row to `<dir>/YYYY-MM-DD.json`.
 * Existing files are skipped unless `overwrite` is true. Used by the CLI script and POST /api/replay/export.
 */
export async function exportReplayData(dir: string, overwrite: boolean): Promise<ReplayExportResult> {
  const outDir = resolve(dir);
  const result: ReplayExportResult = { dir: outDir, written: [], skipped: [] };

  const rows = await listAllReplayData();
  if (rows.length === 0) return result;

  await mkdir(outDir, { recursive: true });
  for (const { date, replayData } of rows) {
    const content = JSON.stringify(replayData, null, 2) + "\n";
    try {
      // "wx" fails with EEXIST when the file is already there — skip it unless overwriting
      await writeFile(join(outDir, `${date}.json`), content, { encoding: "utf-8", flag: overwrite ? "w" : "wx" });
      result.written.push(date);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
      result.skipped.push(date);
    }
  }
  return result;
}
