# Task 05 — Add AI Session Status to Health Check API

## Goal

Expose the AI chat session's runtime state in `GET /api/status` so operators can confirm the session is initialized, which provider is active, and catch errors without tailing logs.

## Updated Response Format

```json
{
  "status": "ok",
  "timestamp": "2026-03-24T10:30:00-04:00",
  "uptime": 42,
  "db": "ok",
  "latencyMs": 4.2,
  "job": {
    "status": "ok",
    "lastRanAt": "2026-03-24T10:30:15-04:00",
    "lastError": null
  },
  "ai": {
    "status": "ok",
    "provider": "gemini",
    "lastMessageAt": "2026-03-24T10:30:15-04:00",
    "lastError": null
  }
}
```

### `ai.status` values

| Value | Meaning |
|---|---|
| `"uninitialized"` | Session not yet started (server just booted) |
| `"ok"` | Last `sendToAI` call succeeded |
| `"error"` | Last `sendToAI` call failed |

### Top-level `status` field

- `"ok"` — db ok AND job is not `"error"` AND ai is not `"error"`
- `"degraded"` — any of: db error, job error, ai error

## Steps

### 1. AI Session State (`server/src/services/aiSession.ts`)

Add session state tracking inline — follow the same pattern as `jobState.ts`.

Define and maintain an internal state object:

```typescript
interface AISessionState {
  status: "uninitialized" | "ok" | "error";
  provider: string;
  lastMessageAt: string | null;
  lastError: string | null;
}
```

- Export `getAISessionState(): AISessionState` — returns a read-only copy
- Update state in `sendToAI`:
  - On success: set `status = "ok"`, update `lastMessageAt` to current ISO timestamp, clear `lastError`
  - On final failure (after restart): set `status = "error"`, update `lastMessageAt`, set `lastError`
- Set `provider` from `config.llm.provider` when session is initialized in `createSession`
- Initial state: `{ status: "uninitialized", provider: "", lastMessageAt: null, lastError: null }`

### 2. Update Status Route (`server/src/routes/status.ts`)

- Import `getAISessionState` from `../services/aiSession.js`
- Include `ai: getAISessionState()` in the response
- Update top-level `status`:
  - `"ok"` if db is ok AND job status is not `"error"` AND ai status is not `"error"`
  - `"degraded"` otherwise

## Done When

- `GET /api/status` returns an `ai` field with `status`, `provider`, `lastMessageAt`, and `lastError`
- `ai.status` starts as `"uninitialized"` on server start
- After first successful `sendToAI` call it becomes `"ok"` with a populated `lastMessageAt`
- After a final failed `sendToAI` call it becomes `"error"` with a populated `lastError`
- Top-level `status` reflects `"degraded"` when AI session is in error state
- TypeScript compiles without errors (`npm run build`)
