# Task 04 — Persistent Gemini AI Chat Session

## Goal

Create a persistent Gemini chat session that starts on server boot, receives 5-minute market snapshots from the cron job, accepts user messages from the frontend via Socket.io, and stores all AI responses in the `AiAdvice` table.

## Session Lifecycle

- Session is initialized on server start with the STRATEGIC_PROMPT
- Session resets every day at **8:00 AM ET** via a daily cron (`0 8 * * 1-5`) — weekdays only
- If the server starts **after** 8:00 AM ET (e.g. mid-morning restart), the session is initialized immediately on boot and history is replayed from today's `MarketSnapshot` records
- On Gemini error: retry once immediately
- If retry fails: restart session, replay today's `MarketSnapshot` records from DB as history context, then resume

## Data Flow

```
Server Start
    → GeminiSession.init()
    → If current ET time >= 08:00: replay today's MarketSnapshot history from DB
    → Send STRATEGIC_PROMPT

Daily at 08:00 AM ET (Mon–Fri)
    → GeminiSession.restart()
    → Fresh session with STRATEGIC_PROMPT (no history replay — new trading day)

Every 5-min tick (cron job)
    → Send snapshot JSON as user message
    → Receive AI markdown response
    → Persist to AiAdvice (source = "job")
    → Emit response to all connected clients via Socket.io

Frontend user message
    → Client emits "chat:message" via Socket.io
    → Forward to GeminiSession.send()
    → Receive AI markdown response
    → Persist to AiAdvice (source = "user")
    → Emit response back via Socket.io "chat:response"
```

## Multi-Provider Architecture

Support three LLM providers behind a common interface. The active provider is set via `LLM_PROVIDER` env var, defaulting to `gemini`.

### Provider Interface (`server/src/services/llm/LLMProvider.ts`)

```typescript
export interface LLMProvider {
  init(systemPrompt: string): Promise<void>;   // initialize with system prompt
  send(message: string): Promise<string>;       // send message, return markdown response
  reset(systemPrompt: string): Promise<void>;   // clear history, re-init with system prompt
}
```

**Important:** OpenAI and Claude are stateless APIs — their providers must maintain conversation history as an in-memory array and include it with every API call. Gemini has native persistent chat via `startChat()`.

### Provider Implementations

| File | Provider | SDK |
|---|---|---|
| `src/services/llm/GeminiProvider.ts` | Google Gemini | `@google/generative-ai` (already installed) |
| `src/services/llm/OpenAIProvider.ts` | OpenAI | `openai` (install required) |
| `src/services/llm/ClaudeProvider.ts` | Anthropic Claude | `@anthropic-ai/sdk` (install required) |

Each provider implements `LLMProvider`. OpenAI and Claude providers maintain a `messages` array internally and pass the full history on each API call.

### Provider Registry & Factory (`server/src/services/llm/index.ts`)

Define a strict provider name type and a registry map so adding a new provider requires only two lines — one in the type, one in the registry:

```typescript
// 1. Add the provider name to this union
export type LLMProviderName = "gemini" | "openai" | "claude";

// 2. Register the provider class in this map
const PROVIDERS: Record<LLMProviderName, () => LLMProvider> = {
  gemini: () => new GeminiProvider(),
  openai: () => new OpenAIProvider(),
  claude: () => new ClaudeProvider(),
};

export function createLLMProvider(): LLMProvider {
  const name = (config.llm.provider as LLMProviderName) ?? "gemini";
  const factory = PROVIDERS[name] ?? PROVIDERS["gemini"];
  return factory();
}
```

**To add a new provider (e.g. Grok):**
1. Create `src/services/llm/GrokProvider.ts` implementing `LLMProvider`
2. Add `"grok"` to `LLMProviderName`
3. Add `grok: () => new GrokProvider()` to `PROVIDERS`
4. Add `grok: { apiKey, model }` block to `config.ts` and `.env.example`

No other files need to change.

## Steps

### 1. Install Additional SDKs

```bash
# from server/
npm install openai @anthropic-ai/sdk
```

### 2. Update Prisma Schema (`server/prisma/schema.prisma`)

Replace the current `AiAdvice` model with:

```prisma
model AiAdvice {
  id        Int      @id @default(autoincrement())
  timestamp DateTime @default(now())
  source    String   // "job" | "user"
  prompt    String?  // user message; null for job-triggered entries
  response  String   // AI response in markdown
  provider  String   // "gemini" | "openai" | "claude"
}
```

Run `npx prisma migrate dev` after updating.

### 3. Config (`server/src/config.ts`)

Replace single `geminiApiKey`/`geminiModel` with a structured `llm` block:

```typescript
llm: {
  provider: process.env.LLM_PROVIDER ?? "gemini",
  gemini: {
    apiKey: process.env.GEMINI_API_KEY ?? "",
    model:  process.env.GEMINI_MODEL  ?? "gemini-2.0-flash",
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY ?? "",
    model:  process.env.OPENAI_MODEL   ?? "gpt-4o",
  },
  claude: {
    apiKey: process.env.ANTHROPIC_API_KEY ?? "",
    model:  process.env.CLAUDE_MODEL      ?? "claude-opus-4-6",
  },
},
```

### 4. Strategic Prompt (`server/src/prompts/strategicPrompt.md`)

Markdown file containing the strategic prompt. Read directly in `aiSession.ts` via `fs.readFileSync` on every session init — no separate loader module needed. Uses ESM-compatible `__dirname` via `fileURLToPath` + `dirname`.

### 5. LLM Provider Implementations

#### `GeminiProvider.ts`
- Uses `model.startChat()` for native persistent session
- `init()`: start chat, send system prompt as first message
- `send()`: call `chat.sendMessage(msg)`, return text
- `reset()`: create new chat instance, re-send system prompt

#### `OpenAIProvider.ts`
- Maintains `messages: { role, content }[]` array in memory
- `init()`: clear messages, push system prompt as `{ role: "system", content }`
- `send()`: push user message, call `openai.chat.completions.create({ messages })`, push assistant response, return text
- `reset()`: clear messages array, re-init

#### `ClaudeProvider.ts`
- Maintains `messages: { role, content }[]` array in memory
- `init()`: clear messages, store system prompt separately (Claude uses a top-level `system` param)
- `send()`: push user message, call `anthropic.messages.create({ system, messages })`, push assistant response, return text
- `reset()`: clear messages array, re-init

### 6. AI Session Service (`server/src/services/aiSession.ts`)

Wraps the active provider with session lifecycle logic.

**Private helper:**
- `createSession(withHistory: boolean): Promise<void>` — creates provider via factory, calls `provider.init(loadPrompt())`, logs the AI response if non-empty, and conditionally replays today's history. All session creation flows go through this single function.

**Exports:**
- `initAISession(): Promise<void>` — calls `createSession(true)`, logs initialized provider name
- `sendToAI(message: string): Promise<string>` — calls `provider.send()`. On error: retries once. If still fails: calls `restartAISession()` and retries one final time
- `restartAISession(): Promise<void>` — logs restart, calls `createSession(true)`
- `scheduleDailyReset(): void` — cron `0 8 * * 1-5` (8:00 AM ET, Mon–Fri): calls `createSession(false)` — fresh session, no history replay

**Prompt loading:**
- `loadPrompt()` reads `strategicPrompt.md` fresh from disk on every call using `fs.readFileSync` — prompt edits are picked up without restarting the server

**History replay (inside `createSession`):**
- Query `MarketSnapshot` WHERE `timestamp >= today 00:00 local` ORDER BY `timestamp ASC`
- For each record: `await provider.send(JSON.stringify(snap.marketData))`
- Discard responses — context restoration only

### 7. Update Cron Job (`server/src/jobs/marketIngestion.ts`)

After building and logging the snapshot:
- Call `sendToAI(JSON.stringify(snapshot.market_data), "job")`
- Persist to `AiAdvice`: `{ source: "job", prompt: null, response, provider: config.llm.provider }`
- Emit to all Socket.io clients: `io.emit("chat:response", { source: "job", response })`

Pass `io` into `startMarketIngestionJob(io)` from `index.ts`.

### 8. Update Server Entry Point (`server/src/index.ts`)

- Call `initAISession()` on server start
- Call `scheduleDailyReset()` on server start
- Pass `io` to `startMarketIngestionJob(io)`
- Add Socket.io handler:

```typescript
socket.on("chat:message", async (message: string) => {
  const response = await sendToAI(message, "user");
  await prisma.aiAdvice.create({
    data: { source: "user", prompt: message, response, provider: config.llm.provider }
  });
  io.emit("chat:response", { source: "user", response });
});
```

### 9. Update `.env.example`

```
LLM_PROVIDER=gemini

GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash

OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o

ANTHROPIC_API_KEY=
CLAUDE_MODEL=claude-opus-4-6
```

## Done When

- Server starts and AI session is initialized with the strategic prompt using the configured provider
- `LLM_PROVIDER=gemini|openai|claude` switches the active provider
- Each provider has its own API key and model config in `.env`
- Every 5-min cron tick sends the snapshot to the AI and persists the markdown response
- Frontend can emit `chat:message` and receive `chat:response` via Socket.io
- Session resets daily at 8:00 AM ET and on server start
- On AI error, session restarts and replays today's history from DB
- TypeScript compiles without errors (`npm run build`)
