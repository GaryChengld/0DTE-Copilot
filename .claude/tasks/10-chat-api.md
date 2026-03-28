# Task 10 — Chat API

## Goal

Implement `POST /api/chat` to allow the user to send a message to the AI, persist both the message and response to the `AiAdvice` table, and return the AI response.

## Endpoint

**`POST /api/chat`**

Request body:

```json
{
  "message": "What is the current market bias?"
}
```

| Field | Required | Notes |
|---|---|---|
| `message` | Yes | User message to send to AI |

## Validation

- `400` if `message` is missing or empty
- `503` if AI session is not available (i.e. `isSessionAvailable()` returns `false`)

## Server Logic

- Send `message` to AI via `sendToAI`
- Persist to `AiAdvice` table via `createAiAdvice` with `source = "user"`
- Return the AI response

## Response

Returns `200` with the AI response:

```json
{
  "response": "Based on current market conditions..."
}
```

## File Structure

- **`server/src/routes/chat.ts`** — Route handler
- Register router in `server/src/index.ts` under `/api`

## Done When

- `POST /api/chat` sends the message to AI, persists to `AiAdvice`, and returns `200` with the response
- `400` returned when `message` is missing or empty
- `503` returned when AI session is not ready
- TypeScript compiles without errors (`npm run build`)

## Status

✅ COMPLETED — 2026-03-26
