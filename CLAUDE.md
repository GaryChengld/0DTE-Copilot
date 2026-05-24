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
- **Market Data:** `yahoo-finance2` (on-demand 5-min OHLC + daily candles for SPX, SPY, and 11 sector ETFs)
- **Indicators:** `technicalindicators` library (VWAP, SMA, RSI, ATR)
- **Charts:** `lightweight-charts` v5 (SPX candlestick chart with VWAP, volume, RSI pane)

## Repository Structure

```
client/    # React frontend — single-page trading dashboard
  src/
    components/       # UI components (StatusBar, ConversationPanel, etc.)
    hooks/            # useSocket, useStatus, useTrades
    api/              # fetch wrappers per domain (chat, trades, analysis, etc.)
    App.tsx           # Root layout — Trading/Review mode toggle; all panels stay mounted (hidden via CSS) to preserve scroll/state across switches
    main.tsx          # Vite entry point
  vite.config.ts      # Vite + Tailwind + proxy to backend

tools/     # Standalone Python utilities
  tv_feed.py          # Polls TradingView for VIX/$ADD/$TICK → POST /api/other_indexes
  tv_export.py        # Exports historical OHLCV + indicators (RSI/SMA/EMA/ATR/MACD) to CSV
  requirements.txt    # Python dependencies
  README.md           # Setup and usage instructions

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
    schema.prisma     # DB schema: AiAdvice, Trade, TradeExit, MarketSummary, OtherIndexSnapshot, NewsKeyword, Journal
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

### Server

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
| [18-latest-news-api](.claude/tasks/18-latest-news-api.md) | GET /api/news — latest economic finance headlines from Finnhub | 2026-04-03 |
| [19-spx-daily-api](.claude/tasks/19-spx-daily-api.md) | GET /api/market-snapshot — SPX daily snapshot + latest VIX/ADD/TICK | 2026-04-08 |
| [20-news-keywords-api](.claude/tasks/20-news-keywords-api.md) | NewsKeyword table + GET/PUT /api/news/keywords — manage news filter keywords via DB | 2026-04-08 |
| [21-spx-candles-api](.claude/tasks/21-spx-candles-api.md) | GET /api/spx/candles — all today's RTH 5-min SPX candles with per-candle VWAP | 2026-04-08 |
| [22-sector-etf-api](.claude/tasks/22-sector-etf-api.md) | GET /api/etf/sectors — live price + % change for 11 S&P 500 sector ETFs | 2026-04-09 |
| [23-journal-api](.claude/tasks/23-journal-api.md) | Journal table + CRUD APIs + AI advices by date + SPX historical candles by date | 2026-04-17 |
| [24-trade-history-apis](.claude/tasks/24-trade-history-apis.md) | Monthly PNL aggregation + trades-by-date query APIs | 2026-04-18 |

### Client

| Task | Description | Date |
|---|---|---|
| [51-init-client](.claude/tasks/51-init-client.md) | Scaffold React client — Vite + Tailwind dark + socket.io-client + base layout | 2026-03-30 |
| [52-status-bar](.claude/tasks/52-status-bar.md) | Status bar — server health, AI state, ET clock, market hours, restart button | 2026-03-30 |
| [53-conversation-panel](.claude/tasks/53-conversation-panel.md) | AI conversation panel + chat/analyze input with Socket.io integration | 2026-04-01 |
| [54-preview-analysis-prompt](.claude/tasks/54-preview-analysis-prompt.md) | Preview analysis prompt panel with Copy button | 2026-04-01 |
| [55-open-positions](.claude/tasks/55-open-positions.md) | Open positions table + exit/delete actions + new trade form | 2026-04-01 |
| [56-market-summary-input](.claude/tasks/56-market-summary-input.md) | Market summary textarea input | 2026-04-01 |
| [57-other-indexes-panel](.claude/tasks/57-other-indexes-panel.md) | Other indexes slide-out panel (VIX/ADD/TICK, hideable, clears on save) | 2026-04-01 |
| [58-news-panel](.claude/tasks/58-news-panel.md) | News panel in right sidebar — economic headlines from Finnhub, tab-switched with Positions | 2026-04-03 |
| [59-tradingview-chart](.claude/tasks/59-tradingview-chart.md) | Market Data panel (left panel) — TradingView embedded SPX chart, extensible for future market data | 2026-04-08 |
| [60-market-snapshot-display](.claude/tasks/60-market-snapshot-display.md) | SPX summary + VIX/ADD/TICK ticker above chart in Market Data panel | 2026-04-08 |
| [61-spx-candle-chart](.claude/tasks/61-spx-candle-chart.md) | Replace TradingView embed with lightweight-charts candlestick chart — SPX 5-min + VWAP + volume + RSI | 2026-04-08 |
| [62-spx-heatmap](.claude/tasks/62-spx-heatmap.md) | Sector ETF heatmap — 11 S&P 500 sector ETFs in 2-column color-coded grid, 30s polling | 2026-04-09 |
| [63-news-keywords-editor](.claude/tasks/63-news-keywords-editor.md) | News Keywords modal editor — inline editable list with add/delete, gear icon in News panel | 2026-04-09 |
| [64-history-panel](.claude/tasks/64-history-panel.md) | Trading/Review mode toggle — Review mode replaces left+middle panels with calendar, SPX chart, AI advice log, and journal editor | 2026-04-18 |
| [65-review-mode-pnl](.claude/tasks/65-review-mode-pnl.md) | Review mode left panel: monthly P&L total, P&L-colored calendar highlights, daily trade details below chart | 2026-04-18 |
| [66-replay-tab](.claude/tasks/66-replay-tab.md) | Review mode right panel: Replay tab generates historical AI analysis payload for selected date | 2026-05-16 |
| [67-replay-data-cache](.claude/tasks/67-replay-data-cache.md) | ReplayData table caches replay payloads by date — instant repeat loads, skips Yahoo Finance | 2026-05-16 |
| [68-rules-engine](.claude/tasks/68-rules-engine.md) | Factory-pattern rules engine: `rules_index.json` registry, `RuleService` interface, three-voter rule, Rules tab in Trading mode | 2026-05-20 |
| [69-backtest-tab](.claude/tasks/69-backtest-tab.md) | Backtest tab in Review mode: bar-by-bar rule simulation with voter table, position tracking, and trade summary | 2026-05-20 |
| [70-sniper-scoring-rule](.claude/tasks/70-sniper-scoring-rule.md) | Sniper Scoring System v1.0: 22-point weighted rule service with MACD/delta helpers; plugs into existing engine and backtest | 2026-05-20 |

### Tools

| Task | Description | Date |
|---|---|---|
| [t01-tv-internals-feeder](.claude/tasks/tools/t01-tv-internals-feeder.md) | Python script — polls TradingView for VIX/$ADD/$TICK and feeds to server | 2026-04-03 |
| [t02-tv-history-exporter](.claude/tasks/tools/t02-tv-history-exporter.md) | Python script — exports historical OHLCV + indicators from TradingView to CSV | 2026-04-04 |

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/status` | Server uptime, DB connectivity, AI session state |
| POST | `/api/chat` | Send user message to AI, persist and broadcast response |
| GET | `/api/ai-advices` | Retrieve latest 20 AI advice records (all sources) |
| POST | `/api/ai-session/restart` | Manually restart AI session |
| POST | `/api/ai/analyze` | Trigger on-demand AI analysis with live market data |
| POST | `/api/ai/analyze/message` | Return analysis payload without sending to AI |
| POST | `/api/market-summary` | Save external market context (GEX, options data, etc.) |
| POST | `/api/other_indexes` | Append intraday VIX/ADD/TICK reading for today |
| POST | `/api/trades` | Open a new trade position |
| POST | `/api/trades/exits` | Exit (partial or full) a trade position |
| GET | `/api/trades/open` | Retrieve all open trades |
| DELETE | `/api/trades/:id` | Delete a trade and its exits |
| GET | `/api/news` | Latest 10 economic finance headlines from Finnhub |
| GET | `/api/news/keywords` | Return all news filter keywords |
| PUT | `/api/news/keywords` | Replace news filter keyword list |
| GET | `/api/market-snapshot` | SPX daily snapshot (price, O/H/L, change, RSI, ATR, MAs) + latest VIX/ADD/TICK |
| GET | `/api/spx/candles` | All today's RTH 5-min SPX candles with VWAP and RSI |
| GET | `/api/spx/candles?date=YYYY-MM-DD` | Historical SPX 5-min candles — last 80 RTH candles ending at the nearest trading day on or before the date |
| GET | `/api/etf/sectors` | Live price + % change for 11 S&P 500 sector ETFs |
| PUT | `/api/journal` | Create or update journal entry for a date (upsert by date) |
| DELETE | `/api/journal/:id` | Delete a journal entry by id |
| GET | `/api/journal?date=YYYY-MM-DD` | Retrieve journal entry for a date |
| GET | `/api/journal/months?year=Y&month=M` | List dates that have a journal entry in a given month |
| GET | `/api/ai-advices?date=YYYY-MM-DD` | Retrieve all user-sourced AI advices for a date |
| GET | `/api/trades/pnl?year=Y&month=M` | Daily P&L totals for a given month (one entry per day with exits) |
| GET | `/api/trades?date=YYYY-MM-DD` | All trades opened or exited on a given date, with full exits |
| GET | `/api/ai/replay/message?date=YYYY-MM-DD` | Historical analysis payload for a past date (no news/15m; all-day 5m candles with per-candle VWAP; daily_stats from Yahoo Finance historical data; market_summary for that date) |

## Health Check

`GET /api/status` — returns server uptime, DB connectivity, AI session state:
```json
{ "status": "ok", "timestamp": "...", "uptime": 42, "db": "ok", "latencyMs": 12.5, "ai": { "status": "ok", ... } }
```

## Architecture

### Application Modes

The UI has two modes toggled by **Trading / Review** buttons in the status bar. All panels stay mounted at all times (hidden via CSS `display: none`) to preserve scroll position and state across switches.

| Mode | Left panel | Middle panel | Right sidebar |
|---|---|---|---|
| **Trading** | `MarketDataPanel` — live SPX chart, snapshot, heatmap | AI Conversation + Preview Prompt tabs + ChatInputBar | News / Positions |
| **Review** | `HistoryPanel` left — monthly P&L total, calendar (P&L-colored), SPX chart, daily trade details | `HistoryPanel` right — AI Advice log + Journal editor + Replay prompt | News / Positions |

### Core Trading Logic (hierarchical, order matters)

1. **VWAP (The Anchor):** Cumulative from 09:30 AM ET. Price above/below VWAP = primary Bullish/Bearish bias.
2. **Market Internals:** $ADD (breadth) and $TICK (NYSE tick) confirm or contradict the VWAP bias — fed via `POST /api/other_indexes` (manually from the UI or automatically via `tools/tv_feed.py`).
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
| `db/marketSummaryRepository.ts` | Stores and retrieves user-supplied market context (GEX, options data); `getMarketSummaryByDate` filters by ET day UTC range |
| `db/otherIndexesRepository.ts` | Upserts and retrieves today's intraday VIX/ADD/TICK snapshots by `tradeDate` + `time` |
| `utils/marketHours.ts` | Helper to check if current time is within RTH (Mon–Fri 09:30–16:00 ET) |
| Socket.io layer | Broadcasts AI responses to frontend via `chat:response` event |
| `services/news.ts` | Fetches latest economic headlines from Finnhub API; keyword-filters using keywords from DB |
| `db/newsKeywordsRepository.ts` | Stores and retrieves news filter keywords from `NewsKeyword` table |
| `routes/marketSnapshot.ts` | `GET /api/market-snapshot` — SPX daily snapshot + latest VIX/ADD/TICK |
| `routes/spxCandles.ts` | `GET /api/spx/candles` — today's RTH 5-min candles with VWAP + RSI; `?date=` returns last 80 RTH candles ending at nearest trading day |
| `routes/sectorEtfs.ts` | `GET /api/etf/sectors` — 11 sector ETF prices and % change |
| `routes/journal.ts` | Journal CRUD — PUT/DELETE/GET `/api/journal`, GET `/api/journal/months` |
| `db/journalRepository.ts` | Upsert, delete, get by date, list dates by month for `Journal` table |
| `routes/trades.ts` | Trade CRUD + exits + `GET /api/trades?date=` + `GET /api/trades/pnl?year=&month=`; `entryTime`/`exitTime` default to ET local time string |
| `db/tradeRepository.ts` | Trade + TradeExit queries; `getMonthlyPnl` aggregates daily P&L from exits; `findTradesByDate` matches trades opened or exited on a date |
| `routes/replay.ts` | `GET /api/ai/replay/message?date=` — historical analysis payload for Review mode Replay tab |
| `tools/tv_feed.py` | Python polling script — fetches VIX/$ADD/$TICK from TradingView and POSTs to `/api/other_indexes` |
| `tools/tv_export.py` | Python export script — downloads historical OHLCV candles from TradingView and computes RSI/SMA/EMA/ATR/MACD indicators into a CSV |

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

### Replay Payload

`GET /api/ai/replay/message?date=YYYY-MM-DD` returns a historical equivalent of the analysis payload for use in the Review mode Replay tab:

```json
{
  "timestamp": "YYYY-MM-DD 16:00 ET",
  "market_data": {
    "spx": {
      "daily_stats": { "price": 0, "o": 0, "h": 0, "l": 0, "vwap": 0, "rsi": 0, "ma": { "5": 0, "20": 0, "50": 0, "100": 0, "200": 0 } },
      "candles_5m": [{ "t": "09:30", "o": 0, "h": 0, "l": 0, "c": 0, "v": 0, "vwap": 0 }]
    },
    "spy": { "daily_stats": { ... } },
    "other_indexes_history": [{ "time": "09:35", "vix": 18.5, "add": -320, "tick": -280 }]
  },
  "positions": [],
  "market_summary": { ... }
}
```

Key differences from the live analysis payload:
- `timestamp` fixed at `16:00 ET` for the selected date
- `candles_5m` contains **all RTH 5-min candles** for that day (not just last 6), each with a per-candle cumulative `vwap`
- `daily_stats` appears **before** `candles_5m`; OHLC/price sourced from Yahoo Finance 1d data (reliable for any date); RSI/MAs from historically-bounded daily closes
- No `candles_15m`, no `news`
- `market_summary` is the last record saved on that specific date (filtered by ET day UTC range); omitted if none
- `positions` = all trades opened or exited on that date (via `findTradesByDate`)

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
