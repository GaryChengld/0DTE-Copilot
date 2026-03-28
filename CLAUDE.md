# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**0DTE SPX Copilot** is a real-time trading decision-support system for SPX zero-days-to-expiration (0DTE) options credit spreads. It combines live market data, technical indicators, and Google Gemini AI to provide trade entry signals and position management advice.

## Tech Stack

- **Runtime:** Node.js v20+ with TypeScript
- **Frontend:** React + Vite + Tailwind CSS + Lucide Icons
- **Backend:** Express.js + `node-cron` (scheduled ingestion) + Socket.io (real-time streaming)
- **Database:** SQLite via Prisma ORM
- **AI:** Google Gemini SDK (persistent chat session per trading day)
- **Market Data:** `yahoo-finance2` (5-minute OHLC intervals for SPX, VIX, $ADD, $TICK)

## Repository Structure

```
server/    # Express backend — data ingestion, VWAP, Gemini AI, Socket.io
  src/
    index.ts          # Entry point: Express + Socket.io server
    config.ts         # Env var loading via dotenv
    routes/           # Express route handlers
    services/         # Business logic (ingestion, vwap, ai, etc.)
    jobs/             # node-cron scheduled jobs
    db/client.ts      # Prisma singleton (uses @prisma/adapter-better-sqlite3)
    generated/prisma/ # Auto-generated Prisma client (do not edit)
  prisma/
    schema.prisma     # DB schema: MarketSnapshot, AiAdvice, Trade, TradeExit
```

## Commands

```bash
# From server/
npm run dev              # start backend with tsx hot-reload
npm run build            # compile TypeScript to dist/
npx prisma migrate dev   # apply schema changes and generate client
npx prisma generate      # regenerate client without migrating
npx prisma studio        # inspect SQLite database
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

## Health Check

`GET /api/status` — returns server uptime, DB connectivity, and latency:
```json
{ "status": "ok", "timestamp": "...", "uptime": 42, "db": "ok", "latencyMs": 12.5 }
```

## Architecture

### Core Trading Logic (hierarchical, order matters)

1. **VWAP (The Anchor):** Cumulative from 09:30 AM EST. Price above/below VWAP = primary Bullish/Bearish bias.
2. **Market Internals:** $ADD (breadth) and $TICK (exhaustion signals) confirm or contradict the VWAP bias.
3. **Gamma Map:** Pre-defined Call Wall, Zero Gamma, and Put Wall levels identify reversal/breakout zones.
4. **AI Copilot:** Persistent Gemini session ingests each 5-minute snapshot and operates in one of two modes:
   - **Observation Mode** — scanning for high-probability entry setups
   - **Management Mode** — protecting and adjusting active positions (Hold / Take Profit / Stop Loss)

### Key Modules (to be built)

| Module | Responsibility |
|---|---|
| Data Ingestion Engine | Fetches SPX OHLC, VIX, $ADD, $TICK every 5 min via `node-cron` |
| VWAP Calculator | Computes cumulative VWAP: `Σ(Price × Volume) / Σ(Volume)` |
| Persistence Layer | Stores all snapshots, AI responses, and trade logs in SQLite |
| AI Copilot | Sends structured snapshots to Gemini; returns "Market Vibe," win probability, and adjustment advice |
| Socket.io Layer | Streams live snapshots and AI responses to the React dashboard |

### Data Flow

```
yahoo-finance2 → Data Ingestion (node-cron)
                         ↓
                  VWAP Calculator
                         ↓
               SQLite (Prisma ORM)
                         ↓
              Gemini AI (persistent session)
                         ↓
            Socket.io → React Dashboard
```

## Environment Variables

Create `server/.env` (gitignored). See `server/.env.example`:
- `GEMINI_API_KEY` — Google Gemini API key
- `DATABASE_URL` — Prisma SQLite path (e.g., `file:./dev.db`)
- `PORT` — server port (default `3001`)

## Prisma Notes

- Prisma 7 uses driver adapters. The SQLite adapter is `@prisma/adapter-better-sqlite3`, initialized with `{ url: "file:./dev.db" }` — **not** a `Database` instance.
- Generated client is in `src/generated/prisma/client.ts` (Prisma 7 outputs `.ts` files, not `.js`).
- After schema changes: run `npx prisma migrate dev` (migrates + regenerates) or just `npx prisma generate` (regenerates only).
