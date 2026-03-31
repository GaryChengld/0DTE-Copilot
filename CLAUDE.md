# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**0DTE SPX Copilot** is a real-time trading decision-support system for SPX zero-days-to-expiration (0DTE) options credit spreads. It combines live market data, technical indicators, and Google Gemini AI to provide trade entry signals and position management advice.

## Tech Stack

- **Runtime:** Node.js v20+ with TypeScript
- **Frontend:** React 18 + Vite + Tailwind CSS + Lucide Icons + socket.io-client + react-markdown
- **Backend:** Express.js + Socket.io (real-time streaming)
- **Database:** SQLite via Prisma ORM
- **AI:** Multi-provider LLM support — Google Gemini, OpenAI, Claude (persistent chat session, lazy-initialized)
- **Market Data:** `yahoo-finance2` (on-demand 5-min OHLC + daily candles for SPX and SPY)
- **Indicators:** `technicalindicators` library (VWAP, SMA, RSI)

## Repository Structure

```
client/    # React frontend — single-page trading dashboard
  src/
    components/       # UI components (StatusBar, ConversationPanel, etc.)
    hooks/            # useSocket, useStatus, useTrades
    api/              # fetch wrappers per domain (chat, trades, analysis, etc.)
    App.tsx           # Root layout
    main.tsx          # Vite entry point
  vite.config.ts      # Vite + Tailwind + proxy to backend

server/    # Express backend — market data, AI session, Socket.io
  src/
    index.ts          # Entry point: Express + Socket.io server
    config.ts         # Env var loading via dotenv
    routes/           # Express route handlers
    services/         # Business logic (marketData, aiSession, llm providers)
    db/               # Prisma client + repositories
    utils/            # Shared utilities (marketHours)
    generated/prisma/ # Auto-generated Prisma client (do not edit)
  prisma/
    schema.prisma     # DB schema: AiAdvice, Trade, TradeExit, MarketSummary, OtherIndexSnapshot
```

## Commands

```bash
# From server/
npm run dev              # start backend with tsx hot-reload
npm run build            # compile TypeScript to dist/
npx prisma migrate dev   # apply schema changes and generate client
npx prisma generate      # regenerate client without migrating
npx prisma studio        # inspect SQLite database

# From client/
npm run dev              # start frontend dev server on http://localhost:5173
npm run build            # build frontend for production
```

## Completed Tasks

| Task | Description | Date |
|---|---|---|
| [01-init-server](.claude/tasks/01-init-server.md) | Scaffold server app, Prisma, health check API | 2026-03-22 |
| [02-market-ingestion-job](.claude/tasks/02-market-ingestion-job.md) | 5-min cron job: SPX/SPY/VIX/$ADD/$TICK snapshot with full-day VWAP | 2026-03-22 |
| [03-job-health-check](.claude/tasks/03-job-health-check.md) | Expose market ingestion job status in GET /api/status | 2026-03-23 |
| [04-ai-chat-session](.claude/tasks/04-ai-chat-session.md) | Persistent Gemini chat session fed by cron job + frontend Socket.io messages | 2026-03-24 |
| [05-ai-session-health-check](.claude/tasks/05-ai-session-health-check.md) | Expose AI session status in GET /api/status | 2026-03-24 |
| [06-open-position-api](.claude/tasks/06-open-position-api.md) | POST /api/trades — open a new trade position | 2026-03-26 |
| [07-exit-position-api](.claude/tasks/07-exit-position-api.md) | POST /api/trades/exits — exit (partial or full) a trade position | 2026-03-26 |
| [08-get-open-trades-api](.claude/tasks/08-get-open-trades-api.md) | GET /api/trades/open — retrieve all open trades | 2026-03-26 |
| [09-delete-trade-api](.claude/tasks/09-delete-trade-api.md) | DELETE /api/trades/:id — delete a trade and its exits | 2026-03-26 |
| [10-chat-api](.claude/tasks/10-chat-api.md) | POST /api/chat — send user message to AI and persist response | 2026-03-26 |
| [11-get-ai-advices-api](.claude/tasks/11-get-ai-advices-api.md) | GET /api/ai-advices — retrieve latest 3 AI advice records | 2026-03-26 |
| [12-restart-ai-session-api](.claude/tasks/12-restart-ai-session-api.md) | POST /api/ai-session/restart — manually restart AI session | 2026-03-26 |
| [13-session-summary-on-restart](.claude/tasks/13-session-summary-on-restart.md) | Replace history replay on restart with compact JSON session summary | 2026-03-27 |
| [14-on-demand-ai-analysis-api](.claude/tasks/14-on-demand-ai-analysis-api.md) | POST /api/ai/analyze — on-demand analysis replacing 5-min cron job | 2026-03-27 |
| [15-get-analysis-message-api](.claude/tasks/15-get-analysis-message-api.md) | POST /api/ai/analyze/message — return analysis payload without sending to AI | 2026-03-28 |
| [16-market-summary-api](.claude/tasks/16-market-summary-api.md) | POST /api/market-summary — save external market context included in analysis payload | 2026-03-29 |
| [17-other-indexes-api](.claude/tasks/17-other-indexes-api.md) | POST /api/other_indexes — manually feed intraday VIX/ADD/TICK history included in analysis payload | 2026-03-30 |
| [51-init-client](.claude/tasks/51-init-client.md) | Scaffold React client — Vite + Tailwind dark + socket.io-client + base layout | — |
| [52-status-bar](.claude/tasks/52-status-bar.md) | Status bar — server health, AI state, ET clock, market hours, restart button | — |
| [53-conversation-panel](.claude/tasks/53-conversation-panel.md) | AI conversation panel + chat/analyze input with Socket.io integration | — |
| [54-preview-analysis-prompt](.claude/tasks/54-preview-analysis-prompt.md) | Preview analysis prompt panel with Copy button | — |
| [55-open-positions](.claude/tasks/55-open-positions.md) | Open positions table + exit/delete actions + new trade form | — |
| [56-market-summary-input](.claude/tasks/56-market-summary-input.md) | Market summary textarea input | — |
| [57-other-indexes-panel](.claude/tasks/57-other-indexes-panel.md) | Other indexes slide-out panel (VIX/ADD/TICK, hideable, clears on save) | — |

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/status` | Server uptime, DB connectivity, AI session state |
| POST | `/api/chat` | Send user message to AI, persist and broadcast response |
| GET | `/api/ai-advices` | Retrieve latest 3 AI advice records |
| POST | `/api/ai-session/restart` | Manually restart AI session |
| POST | `/api/ai/analyze` | Trigger on-demand AI analysis with live market data |
| POST | `/api/ai/analyze/message` | Return analysis payload without sending to AI |
| POST | `/api/market-summary` | Save external market context (GEX, options data, etc.) |
| POST | `/api/other_indexes` | Append intraday VIX/ADD/TICK reading for today |
| POST | `/api/trades` | Open a new trade position |
| POST | `/api/trades/exits` | Exit (partial or full) a trade position |
| GET | `/api/trades/open` | Retrieve all open trades |
| DELETE | `/api/trades/:id` | Delete a trade and its exits |

## Health Check

`GET /api/status` — returns server uptime, DB connectivity, AI session state:
```json
{ "status": "ok", "timestamp": "...", "uptime": 42, "db": "ok", "latencyMs": 12.5, "ai": { "status": "ok", ... } }
```

## Architecture

### Core Trading Logic (hierarchical, order matters)

1. **VWAP (The Anchor):** Cumulative from 09:30 AM ET. Price above/below VWAP = primary Bullish/Bearish bias.
2. **Market Internals:** $ADD (breadth) and $TICK (NYSE tick) confirm or contradict the VWAP bias — fed manually via `POST /api/other_indexes`.
3. **Gamma Map:** User-supplied GEX levels (Call Wall, GEX Flip, Put Wall) stored via `/api/market-summary` identify reversal/breakout zones.
4. **AI Copilot:** Persistent LLM session (lazy-initialized on first use), triggered on-demand. Operates in two modes:
   - **Observation Mode** — scanning for high-probability entry setups
   - **Management Mode** — protecting and adjusting active positions (Hold / Take Profit / Stop Loss)

### Key Modules

| Module | Responsibility |
|---|---|
| `services/marketData.ts` | Fetches today's 5-min RTH candles (SPX, SPY) + 300 days daily closes; builds 15m aggregation, last-6 5m candles, VWAP, RSI, MAs |
| `services/aiSession.ts` | Lazy-initialized LLM session; send + background restart after analysis; session summary on restart |
| `routes/analysis.ts` | Builds analysis payload and sends to AI (`/api/ai/analyze`) or returns it (`/api/ai/analyze/message`) |
| `db/marketSummaryRepository.ts` | Stores and retrieves user-supplied market context (GEX, options data) |
| `db/otherIndexesRepository.ts` | Upserts and retrieves today's intraday VIX/ADD/TICK snapshots by `tradeDate` + `time` |
| `utils/marketHours.ts` | Helper to check if current time is within RTH (Mon–Fri 09:30–16:00 ET) |
| Socket.io layer | Broadcasts AI responses to frontend via `chat:response` event |

### Analysis Payload

When analysis is triggered, the following JSON is sent to AI:

```json
{
  "timestamp": "2026-03-30 10:15 ET",
  "market_data": {
    "spx": {
      "candles_15m": [{ "t": "09:30", "o": 0, "h": 0, "l": 0, "c": 0, "v": 0 }],
      "candles_5m": [{ "t": "11:00", "o": 0, "h": 0, "l": 0, "c": 0, "v": 0 }],
      "daily_stats": { "o": 0, "h": 0, "l": 0, "vwap": 0, "rsi": 0, "ma": { "5": 0, "20": 0, "50": 0, "100": 0, "200": 0 } }
    },
    "spy": { "daily_stats": { ... } },
    "other_indexes_history": [
      { "time": "09:35", "vix": 18.5, "add": -320, "tick": -280 },
      { "time": "09:40", "vix": 19.2, "add": -450 }
    ]
  },
  "open_positions": [],
  "market_summary": { ... },
  "user_notes": "optional free text or JSON from user"
}
```

- `candles_15m`: all RTH 15-min candles from market open (aggregated from 5-min candles), ascending
- `candles_5m`: latest 6 RTH 5-min candles (last ~30 minutes of price action)
- `daily_stats.ma`: daily MAs (5/20/50/100/200) from 300 days of daily candle history
- `daily_stats.rsi`: 14-period daily RSI
- `daily_stats.vwap`: cumulative intraday VWAP (SPX uses SPY volume)
- `market_data.other_indexes_history`: today's VIX/ADD/TICK readings from `POST /api/other_indexes`; null fields omitted per entry; omitted when empty
- `market_summary`: latest record from `POST /api/market-summary` (omitted if none)
- `user_notes`: optional field from request body (omitted if not provided)

### AI Session Behaviour

- **Lazy init:** session is created on the first call to `sendToAI()`, not at server startup
- **Restart on analysis:** `POST /api/ai/analyze` always restarts the session after sending (generates a session summary, stores it, then reinitializes — ready for next analysis)
- **Manual restart:** `POST /api/ai-session/restart` triggers the same restart flow
- **Session summary:** stored as `AiAdvice` with `source: "session_summary"`, injected into new session as `[SESSION CONTEXT]`

### Data Flow

```
User triggers POST /api/ai/analyze
              ↓
    fetchMarketData()            — Yahoo Finance (5-min + daily candles), parallel
    findOpenTrades()             — SQLite                                  parallel
    getLatestMarketSummary()     — SQLite                                  parallel
    getTodayOtherIndexSnapshots() — SQLite                                 parallel
              ↓
    buildAnalysisPayload() — assemble JSON, aggregate 15m candles
              ↓
    sendToAI(payload) — LLM provider (Gemini / OpenAI / Claude)
              ↓
    createAiAdvice() — persist to SQLite
    io.emit("chat:response") — broadcast via Socket.io
    return response to caller
              ↓ (background, fire-and-forget)
    restartAISession() — generate summary → store → reinitialize
```

## Environment Variables

Create `server/.env` (gitignored). See `server/.env.example`:
- `GEMINI_API_KEY` — Google Gemini API key
- `OPENAI_API_KEY` — OpenAI API key
- `ANTHROPIC_API_KEY` — Anthropic (Claude) API key
- `LLM_PROVIDER` — `gemini` | `openai` | `claude` (default: `gemini`)
- `GEMINI_MODEL` — default `gemini-2.0-flash`
- `OPENAI_MODEL` — default `gpt-4o`
- `CLAUDE_MODEL` — default `claude-opus-4-6`
- `DATABASE_URL` — Prisma SQLite path (e.g., `file:./dev.db`)
- `PORT` — server port (default `3001`)
- `PROMPT_FILE` — which prompt file to load (default: `strategicPrompt.md`)
- `SESSION_SUMMARY_INTERVAL` — messages before auto-restart (default: `20`)

## Prisma Notes

- Prisma 7 uses driver adapters. The SQLite adapter is `@prisma/adapter-better-sqlite3`, initialized with `{ url: "file:./dev.db" }` — **not** a `Database` instance.
- Generated client is in `src/generated/prisma/client.ts` (Prisma 7 outputs `.ts` files, not `.js`).
- After schema changes: run `npx prisma migrate dev` (migrates + regenerates) or just `npx prisma generate` (regenerates only).
- Migration files are created manually when `prisma migrate dev` cannot run interactively — use `prisma migrate deploy` to apply them.
