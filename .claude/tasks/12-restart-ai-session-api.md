# Task 12 — Restart AI Session API ✅ COMPLETED

## Goal

Implement `POST /api/ai-session/restart` to allow operators to manually restart the AI session and replay today's history.

## Endpoint

**`POST /api/ai-session/restart`**

No request body.

## Server Logic

- Call `restartAISession()` from `aiSession.ts`
- Return the updated AI session state after restart

## Response

Returns `200` on success:

```json
{
  "status": "ok",
  "provider": "gemini",
  "lastMessageAt": "2026-03-25T14:30:00.000Z",
  "lastError": null
}
```

Returns `500` if restart throws an exception:

```json
{
  "error": "Failed to restart AI session: <error message>"
}
```

## File Structure

- **`server/src/routes/chat.ts`** — Add POST route handler (same file as tasks 10 and 11)

## Done When

- `POST /api/ai-session/restart` restarts the AI session and returns `200` with updated session state
- `500` returned if restart fails
- TypeScript compiles without errors (`npm run build`)

## Status

✅ COMPLETED — 2026-03-26
