# Task 25 — Export Replay Data

## Goal

Export every cached replay payload in the `ReplayData` table (task 67) to disk, one pretty-printed JSON file per day, so replay data can be archived or used outside the app. Available as a command-line script, a REST endpoint, and an **Export All** button in Review mode; all use the same `exportReplayData()` service.

## Configuration — export folder

All three entry points write to the folder set by `REPLAY_EXPORT_DIR`, read in `server/src/config.ts`:

```ts
replayExportDir: process.env.REPLAY_EXPORT_DIR ?? "exports/replay",
```

- **Default:** `exports/replay` → `server/exports/replay` (gitignored via `/exports` in `server/.gitignore`)
- **Change it:** add to `server/.env` (template line is commented in `server/.env.example`):
  ```
  REPLAY_EXPORT_DIR=D:\data\replay-export
  ```
- Absolute or relative; relative paths resolve against the server's working directory (normally `server/`). May point outside the repo; the folder is created on first export
- `.env` is read at startup — **restart the backend** after changing it for the API / Export All button to use the new folder
- The CLI reads the same setting; a folder argument (`npm run export:replay -- D:\other`) overrides it for that run. The REST API and button have no folder parameter

## Usage

From `server/`:

```bash
npm run export:replay                              # → $REPLAY_EXPORT_DIR, default exports/replay
npm run export:replay -- D:\data\replay            # explicit folder (overrides REPLAY_EXPORT_DIR)
npm run export:replay -- --overwrite [folder]      # replace files that already exist
```

- One file per cached date: `<dir>/YYYY-MM-DD.json` — the exact cached payload (same JSON as `GET /api/ai/replay/message?date=` returns for a cached past date)
- Folder is created if missing
- **Existing files are skipped** by default (written with the `wx` flag); `--overwrite` or `--overwrite=true` replaces them, `--overwrite=false` is the same as omitting it. The summary reports written and skipped counts
- Flags go after `--` so npm passes them to the script; flag and folder can be in either order; unknown options fail with exit code 1
- Only days already cached (opened in the Replay tab) are exported — no Yahoo Finance calls
- Read-only against the database; safe to run while the server is running

### REST API

`POST /api/replay/export` — no body. Exports to `REPLAY_EXPORT_DIR` with **overwrite always false** (existing files skipped; use the CLI with `--overwrite` to replace). The folder is not a request parameter, so callers can't write to arbitrary paths.

```json
{
  "dir": "C:\\Workspaces\\0DTE-Copilot\\server\\exports\\replay",
  "writtenCount": 2,
  "skippedCount": 121,
  "written": ["2026-09-10", "2026-09-11"],
  "skipped": ["2026-03-19", "..."]
}
```

Errors return `500 { "error": "..." }`. No cached data → `200` with both lists empty.

### UI — Export All button

Review mode → right panel → **Replay** tab: an **Export All** button sits in the tab bar next to the selected date (shown only while the Replay tab is active, since it exports all days, not just the selected one). It calls `POST /api/replay/export` via `exportAllReplays()` in `client/src/api/replay.ts`, shows a spinner while running, then `Exported N · skipped M` (hover for the server folder) or the error in red.

## Files

| File | Change |
|---|---|
| `server/src/services/replayExport.ts` | `exportReplayData(dir, overwrite)` → `{ dir, written, skipped }` — resolves/creates the folder, writes one file per row (`wx` flag skips existing unless overwrite) |
| `server/src/scripts/exportReplayData.ts` | CLI — parses `[folder] [--overwrite]`, calls `exportReplayData()`, prints the written files and a summary, disconnects Prisma |
| `server/src/routes/replay.ts` | `POST /api/replay/export` — calls `exportReplayData(config.replayExportDir, false)` |
| `client/src/api/replay.ts` | `exportAllReplays()` + `ReplayExportResult` type |
| `client/src/components/HistoryPanel.tsx` | `ReplayExportButton` in the right tab bar (Replay tab only) |
| `server/src/db/replayDataRepository.ts` | `listAllReplayData()` — all rows (`date`, `replayData`) ordered by date |
| `server/src/config.ts` | `replayExportDir` from `REPLAY_EXPORT_DIR` (default `exports/replay`) |
| `server/package.json` | `export:replay` script (`tsx src/scripts/exportReplayData.ts`) |
| `server/.gitignore` | `/exports` |
| `server/.env.example` | Documents `REPLAY_EXPORT_DIR` |

No schema change, no migration.

## Verification

1. `npx tsc --noEmit -p .` type-checks (the script lives under `src/`)
2. `npm run export:replay -- <tmp dir>` — printed count equals the number of `ReplayData` rows
3. An exported file matches `GET /api/ai/replay/message?date=<date>` for that date
4. Running with no argument writes to `server/exports/replay`, which `git status` ignores
5. Re-run without `--overwrite` → 0 written, all skipped; a deleted file is recreated and an edited file is left alone
6. Re-run with `--overwrite` → all files rewritten (edited file restored)
7. Delete two exported files, `POST /api/replay/export` → `writtenCount: 2` (those dates), `skippedCount` = the rest; POST again → `writtenCount: 0`
8. Review mode → Replay tab → **Export All** → status shows `Exported N · skipped M`; button hidden on other tabs

## History

| Date | Change |
|---|---|
| 2026-09-13 | Initial export script — one `YYYY-MM-DD.json` per cached day, always overwrote existing files |
| 2026-09-13 | Added `--overwrite[=true\|false]` parameter. **Default changed to skip existing files**; `--overwrite` restores the replace behavior. Summary now reports skipped count; unknown options exit with code 1 |
| 2026-09-13 | Moved the export logic into `services/replayExport.ts` and added `POST /api/replay/export` (overwrite always false, folder from `REPLAY_EXPORT_DIR`); CLI now calls the same service |
| 2026-09-13 | Added **Export All** button to the Review-mode Replay tab bar, calling `POST /api/replay/export` |
| 2026-09-13 | Documented the export-folder configuration (`REPLAY_EXPORT_DIR` / `config.replayExportDir`) |

## Status

Completed 2026-09-13.
