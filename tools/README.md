# 0DTE Copilot — Tools

Standalone Python utilities for the 0DTE SPX Copilot.

---

## tv_feed.py — TradingView Internals Feeder

Polls TradingView every N minutes for **VIX**, **$ADD**, and **$TICK**, and automatically
feeds the values into the copilot via `POST /api/other_indexes`. Replaces manual entry in
the Other Indexes panel.

### Prerequisites

- Python 3.9+
- A [TradingView](https://www.tradingview.com) account (free tier works)
- The 0DTE Copilot server running on `http://localhost:3001`

### Setup (first time only)

```bash
# 1. Open a terminal and navigate to this folder
cd tools/

# 2. Create a Python virtual environment
python -m venv venv

# 3. Activate the virtual environment
# Windows:
venv\Scripts\activate
# macOS / Linux:
source venv/bin/activate

# 4. Install dependencies (tvdatafeed is installed from GitHub, requires git)
pip install -r requirements.txt

# 5. Create your credentials file
copy .env.example .env       # Windows
# cp .env.example .env       # macOS / Linux

# 6. Open .env and fill in your TradingView credentials
#    TV_USERNAME=your_username
#    TV_PASSWORD=your_password
#    SERVER_URL=http://localhost:3001
```

### Starting the feeder

```bash
# Activate the virtual environment first (if not already active)
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS / Linux

# Poll every 5 minutes (default)
python tv_feed.py

# Poll every 1 minute
python tv_feed.py --interval 1

# Custom server URL
python tv_feed.py --server http://localhost:3001
```

### What it does

Every polling interval, the script:
1. Fetches the latest closed candle for VIX (CBOE), $ADD (NYSE), and $TICK (NYSE) from TradingView
2. POSTs the values to the copilot server
3. Prints a status line confirming the update:
   ```
   [10:35 ET] VIX=14.52  ADD=-320  TICK=-280  → 201 OK
   ```

The values will appear immediately in the **Other Indexes** panel in the frontend.

### Stopping

Press `Ctrl+C` to stop the feeder.

### Supported intervals

| `--interval` | Description |
|---|---|
| `1` | Every 1 minute |
| `3` | Every 3 minutes |
| `5` | Every 5 minutes (default) |
| `15` | Every 15 minutes |
| `30` | Every 30 minutes |
| `45` | Every 45 minutes |

### Troubleshooting

| Problem | Fix |
|---|---|
| `TV_USERNAME and TV_PASSWORD must be set` | Check your `.env` file exists and has correct values |
| `WARNING: failed to fetch add` | $ADD may be temporarily unavailable on TradingView — script continues |
| `WARNING: HTTP error posting to server` | Make sure the copilot server is running on the configured `SERVER_URL` |
| `ModuleNotFoundError` | Run `pip install -r requirements.txt` with the virtual environment active |

---

## tv_export.py — TradingView History Exporter

Exports historical OHLCV candle data from TradingView to a CSV file in `tools/data/`.
Used for building datasets for backtesting.

> **Setup:** Uses the same `venv` and `.env` as `tv_feed.py` — no additional setup needed.

### Usage

```bash
# Activate the virtual environment first (if not already active)
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS / Linux

# Export 20000 bars of SPX 5-minute candles
python tv_export.py --symbol SPX --exchange INDEX --timeframe 5 --bars 20000 --out spx_5m.csv

# Export 300 days of SPY daily candles
python tv_export.py --symbol SPY --exchange AMEX --timeframe 1d --bars 300 --out spy_daily.csv
```

Output is saved to `tools/data/<filename>`. The `data/` folder is gitignored.

### Parameters

| Argument | Description |
|---|---|
| `--symbol` | Ticker symbol, e.g. `SPX`, `SPY`, `QQQ` |
| `--exchange` | Exchange, e.g. `INDEX`, `AMEX`, `NASDAQ`, `USI` |
| `--timeframe` | `1` `3` `5` `15` `30` `45` `1h` `2h` `4h` `1d` `1w` |
| `--bars` | Number of candles to fetch |
| `--out` | Output filename (saved under `tools/data/`) |

### Output CSV Format

```
datetime,open,high,low,close,volume
2025-10-01 09:30:00,5120.10,5128.00,5118.20,5125.80,121000
2025-10-01 09:35:00,5125.80,5132.40,5123.10,5130.20,98000
```

### Troubleshooting

| Problem | Fix |
|---|---|
| `ERROR: no data returned` | Check `--symbol` and `--exchange` are correct for TradingView |
| `ERROR: unsupported timeframe` | Use one of: `1` `3` `5` `15` `30` `45` `1h` `2h` `4h` `1d` `1w` |
| `TV_USERNAME and TV_PASSWORD must be set` | Check your `.env` file exists and has correct values |
