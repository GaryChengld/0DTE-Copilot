# Task 13 — AI Session Summary on Restart

## Goal

Replace history replay on session restart with a compact JSON summary, saving tokens
significantly (one summary message vs 78+ snapshot replays by midday).

The session also **auto-restarts** when the message count hits a configurable threshold,
so no manual intervention is needed. Open positions are excluded from the summary —
they are already sent to the AI every 5 minutes by the ingestion job.

## Changes

### `server/.env.example`

Add:
```
# Auto-restart AI session after this many messages (default: 20)
SESSION_SUMMARY_INTERVAL=20
```

### `server/src/config.ts`

Add to config object:
```typescript
sessionSummaryInterval: parseInt(process.env.SESSION_SUMMARY_INTERVAL ?? "20", 10),
```

### `server/src/db/ingestionRepository.ts`

Add one new export:

```typescript
export async function getTodaySessionSummary(): Promise<string | null>
```

- Queries `AiAdvice` where `source = "session_summary"` and `timestamp >= today start`
- Orders by `timestamp desc`, takes 1
- Returns `response` (the summary string) or `null` if none found today

### `server/src/prompts/summaryPrompt.md` (new file)

Create this file with the summary prompt content:

```
[SESSION SUMMARY REQUEST] Summarize today's trading session context in compact JSON.
Exclude open positions — they are sent separately every 5 minutes.

{
  "session_date": "YYYY-MM-DD",
  "regime": "...",
  "opening_pattern": "...",
  "bias": "Bullish | Bearish | Neutral",
  "weighted_score": 0.0,
  "vix_dynamics": {
    "trend": "...",
    "relative_to_iv": "..."
  },
  "key_levels": { "gex_flip": 0, "call_wall": 0, "put_wall": 0 },
  "sentiment_signals": {
    "tick_breadth": "...",
    "internals": "..."
  },
  "setups_considered": ["..."],
  "notes": "..."
}
```

### `server/src/services/aiSession.ts`

Load the summary prompt using `readFileSync` (same pattern as `loadPrompt`):

```typescript
function loadSummaryPrompt(): string {
  return readFileSync(join(__dirname, "../prompts/summaryPrompt.md"), "utf-8");
}
```

Use `loadSummaryPrompt()` wherever `SUMMARY_PROMPT` is referenced — no hardcoded constant.

**Add** a `messageCount` counter (module-level `let messageCount = 0`).

**Modify** `sendToAI`:
- Increment `messageCount` on every successful send (outside `isReplaying`)
- After incrementing, check: if `messageCount >= config.sessionSummaryInterval`, call `restartAISession()` and reset `messageCount = 0`

**Modify** `restartAISession` to:
1. Log `[aiSession] generating session summary...`
2. Ask current `provider` to summarize using `SUMMARY_PROMPT`
   (call `provider.send()` directly — not `sendToAI` — to avoid triggering another auto-restart)
3. Store summary via `createAiAdvice` with `source: "session_summary"`
4. Log `[aiSession] session summary stored, restarting...`
5. Call `createSession()` — new provider, summary injected inside `createSession`

Wrap steps 2–3 in try/catch: on failure, log a warning and proceed with `createSession()`
without a summary (fresh session, no replay fallback).

**Reset** `messageCount = 0` inside `createSession` so the counter starts fresh after any restart.

**Modify** `createSession` to remove the `withHistory` / `replayTodayHistory` logic entirely.
Replace it with: after `provider.init`, call `getTodaySessionSummary()`. If a summary exists,
send `"[SESSION CONTEXT] " + summary` to the new session. If no summary exists, start with
no context message (fresh session).

Remove the `withHistory` parameter from `createSession`, `initAISession`, and `restartAISession`.
Remove `replayTodayHistory` entirely — it is no longer called anywhere.

## No Schema Changes

`AiAdvice.source` is a plain `String` — `"session_summary"` is a new value,
no migration needed.

## Done When

- Session auto-restarts after `SESSION_SUMMARY_INTERVAL` messages (default 20)
- `POST /api/ai-session/restart` also triggers the summary flow when called manually
- Server logs show `[aiSession] generating session summary...` and no snapshot replay log on restart
- `GET /api/ai-advices` returns a record with `source: "session_summary"` after a restart
- If summary generation fails, session restarts with no context (fresh session)
- `SESSION_SUMMARY_INTERVAL` in `.env` controls the threshold
- TypeScript compiles without errors (`npm run build`)
