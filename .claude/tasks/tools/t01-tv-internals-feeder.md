# Tool T01 — TradingView Internals Feeder

## Goal

A standalone Python script that polls TradingView every 5 minutes for VIX, $ADD, and $TICK,
then POSTs the values to the local server's `POST /api/other_indexes` endpoint. Replaces
manual data entry in the Other Indexes panel. Runs entirely on localhost — no public URL needed.

## Location

```
tools/
  tv_feed.py          ← polling script
  requirements.txt    ← tvdatafeed, pandas, python-dotenv, requests
  .env.example        ← TV_USERNAME / TV_PASSWORD / SERVER_URL
```

## Usage

```bash
cd tools/
python tv_feed.py              # polls every 5 minutes
python tv_feed.py --interval 1 # polls every 1 minute
```

## Parameters

| Arg | Default | Description |
|---|---|---|
| `--interval` | `5` | Polling interval in minutes |
| `--server` | `http://localhost:3001` | Base URL of the local server |

## Credentials & Config

`tools/.env` (gitignored):
```
TV_USERNAME=your_tradingview_username
TV_PASSWORD=your_tradingview_password
SERVER_URL=http://localhost:3001
```

Loaded via `python-dotenv`. Falls back to `SERVER_URL` default if not set. Exits with error
if `TV_USERNAME` or `TV_PASSWORD` are missing.

## TradingView Symbols

| Metric | Symbol | Exchange |
|---|---|---|
| VIX | `VIX` | `CBOE` |
| $ADD | `ADD` | `USI` |
| $TICK | `TICK` | `USI` |

Fetched using `tvdatafeed.get_hist(symbol, exchange, interval, n_bars=2)`.
Use the close of index `-2` (last **closed** candle) to avoid partial/open candle values.

## Interval Mapping

| `--interval` | `Interval` enum |
|---|---|
| `1` | `Interval.in_1_minute` |
| `3` | `Interval.in_3_minute` |
| `5` | `Interval.in_5_minute` |
| `15` | `Interval.in_15_minute` |
| `30` | `Interval.in_30_minute` |
| `45` | `Interval.in_45_minute` |

Exit with error if an unsupported interval is provided.

## Script Logic

```
1. Parse CLI args (argparse)
2. Load TV_USERNAME / TV_PASSWORD / SERVER_URL from .env
3. Connect: tv = TvDatafeed(username, password)
4. Map --interval → Interval enum
5. Loop forever:
     a. Fetch last 2 bars for VIX, ADD, TICK in parallel (ThreadPoolExecutor)
     b. Take close value at index -2 (last closed candle) for each
     c. Get current ET time as "HH:MM"
     d. POST to {SERVER_URL}/api/other_indexes:
        { "time": "HH:MM", "vix": 14.5, "add": -320, "tick": -280 }
     e. Print: "[10:35 ET] VIX=14.5  ADD=-320  TICK=-280  → 201 OK"
     f. On HTTP error: print warning and continue (do not crash)
     g. On TradingView fetch error: print warning and continue (do not crash)
     h. Sleep until next clock-aligned interval boundary
        (e.g. for 5m: fires at :00 :05 :10 ... not drifting from start time)
```

## API Payload

`POST /api/other_indexes` (existing endpoint, `time` is required):
```json
{ "time": "10:35", "vix": 14.5, "add": -320, "tick": -280 }
```

## Files to Create

| File | Description |
|---|---|
| `tools/tv_feed.py` | Main polling script |
| `tools/requirements.txt` | `tvdatafeed` (from GitHub), `pandas`, `python-dotenv`, `requests` |
| `tools/.env.example` | Credentials + server URL template |

Ensure `tools/.env` is listed in the root `.gitignore`.

## Setup & Installation

```bash
# 1. Create a virtual environment (recommended)
cd tools/
python -m venv venv

# 2. Activate it
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Copy and fill in credentials
cp .env.example .env
# Edit .env with your TradingView username and password

# 5. Run
python tv_feed.py
```

## Done When

- `python tv_feed.py --interval 1` prints a status line every minute
- Values appear in the Other Indexes panel in the frontend after each poll
- Script continues running on TradingView or HTTP errors (just prints a warning)
- Ctrl+C exits cleanly
