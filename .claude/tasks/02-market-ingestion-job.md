# Task 02 — Market Data Ingestion Job with VWAP ✅ COMPLETED (2026-03-23)

## Goal

Create a `node-cron` job that runs every 5 minutes and outputs a JSON snapshot of real-time market data for SPX, SPY, and VIX — including statistically complete VWAP recalculated from today's full 5-minute candle history.

## Output Format

```json
{
  "timestamp": "2026-03-23T10:30:00-04:00",
  "market_data": {
    "spx": {
      "current": {
        "open": 5120.1,
        "high": 5125.4,
        "low": 5118.2,
        "close": 5122.3,
        "volume": 45000000
      },
      "daily": {
        "open": 5110.5,
        "high": 5130.2,
        "low": 5105.8,
        "volume": 1200000000
      },
      "vwap": 5121.5
    },
    "spy": {
      "current": {
        "open": 511.5,
        "high": 512.1,
        "low": 510.9,
        "close": 511.8,
        "volume": 1250000
      },
      "daily": {
        "open": 510.2,
        "high": 512.8,
        "low": 509.4,
        "volume": 45000000
      },
      "vwap": 511.4
    },
    "vix": 14.5
  }
}
```

## Steps

### 1. Market Data Service (`server/src/services/marketData.ts`)
- Use `yahoo-finance2` to fetch data for the following tickers:
  - `^GSPC` → SPX
  - `SPY` → SPY
  - `^VIX` → VIX
- Fetch the current 5-minute OHLC candle using `chart()` with `interval: "5m"` and `range: "1d"`.
- Fetch daily OHLC (open, high, low, volume for the full trading day so far) from the same chart response.
- Extract `open`, `high`, `low`, `close`, `volume` for both `current` (latest 5m candle) and `daily` (day aggregate).

### 2. VWAP Calculator (`server/src/services/vwap.ts`)
- Fetch all 5-minute candles from today's market open (09:30 AM EST) to now using `yahoo-finance2` `chart()` with `interval: "5m"` and `range: "1d"`.
- For each candle compute: `typicalPrice = (high + low + close) / 3`
- Compute: `VWAP = Σ(typicalPrice × volume) / Σ(volume)` across all candles today.
- Return a single number rounded to 2 decimal places.
- Apply independently to both `^GSPC` (SPX) and `SPY`.
- **Important:** Always recompute from the full day's history on every tick — never use a rolling or incremental approach.

### 3. Snapshot Builder (`server/src/services/snapshotBuilder.ts`)
- Orchestrates calls to `marketData` and `vwap` services.
- Assembles the full JSON snapshot per the format above.
- Timestamps in ISO 8601 with Eastern time offset (use `Intl.DateTimeFormat` or a timezone library).

### 4. Cron Job (`server/src/jobs/marketIngestion.ts`)
- Schedule with `node-cron` using cron expression `*/5 * * * *` (every 5 minutes).
- Call `snapshotBuilder` and `console.log(JSON.stringify(snapshot, null, 2))`.
- Also persist the snapshot to SQLite via Prisma (`MarketSnapshot` model) if the model exists; skip persistence if not yet defined.
- Export a `startMarketIngestionJob()` function.

### 5. Wire into server (`server/src/index.ts`)
- Import and call `startMarketIngestionJob()` on server startup.

## VWAP Context

- VWAP is the absolute intraday institutional benchmark.
- It must be recalculated from scratch every 5 minutes using ALL 5-minute candles since today's open (09:30 AM EST).
- Do NOT use a rolling or incremental VWAP — always recompute from the full day's candle history.

## Done When

- Running `npm run dev` starts the server and the cron job fires every 5 minutes.
- A valid JSON snapshot matching the format above is printed to stdout on each tick.
- VWAP values are statistically complete (computed from full day history, not just the latest candle).
- TypeScript compiles without errors (`npm run build`).
