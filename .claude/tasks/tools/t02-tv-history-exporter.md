# Tool T02 — TradingView History Exporter

## Goal

A standalone Python script that exports historical OHLCV candle data from TradingView to a CSV
file. Used to build datasets for backtesting. Output files are saved to `tools/data/` (gitignored).

## Location

```
tools/
  tv_export.py        ← export script
  data/               ← output CSVs (gitignored)
```

Uses the same `venv`, `requirements.txt`, and `.env` as `tv_feed.py` — no new dependencies needed.

## Usage

```bash
python tv_export.py --symbol SPX --exchange INDEX --timeframe 5 --bars 20000 --out spx_5m.csv
python tv_export.py --symbol SPY --exchange AMEX --timeframe 1d --bars 300 --out spy_daily.csv
```

Output file is saved to `tools/data/<filename>`.

## Parameters

| Arg | Required | Description |
|---|---|---|
| `--symbol` | yes | Ticker symbol, e.g. `SPX`, `SPY`, `QQQ` |
| `--exchange` | yes | Exchange, e.g. `INDEX`, `AMEX`, `NASDAQ`, `USI` |
| `--timeframe` | yes | See timeframe mapping below |
| `--bars` | yes | Number of candles to fetch |
| `--out` | yes | Output filename (saved under `tools/data/`) |

## Timeframe Mapping

| `--timeframe` | Interval enum |
|---|---|
| `1` | `Interval.in_1_minute` |
| `3` | `Interval.in_3_minute` |
| `5` | `Interval.in_5_minute` |
| `15` | `Interval.in_15_minute` |
| `30` | `Interval.in_30_minute` |
| `45` | `Interval.in_45_minute` |
| `1h` | `Interval.in_1_hour` |
| `2h` | `Interval.in_2_hour` |
| `4h` | `Interval.in_4_hour` |
| `1d` | `Interval.in_daily` |
| `1w` | `Interval.in_weekly` |

Exit with error message if an unsupported timeframe is provided.

## Script Logic

```
1. Parse CLI args (argparse) — all args required
2. Load TV_USERNAME / TV_PASSWORD from .env (same file as tv_feed.py)
3. Exit with error if credentials are missing
4. Ensure tools/data/ directory exists (create if not)
5. Connect: tv = TvDatafeed(username, password)
6. Map --timeframe → Interval enum (error if unsupported)
7. Fetch: df = tv.get_hist(symbol, exchange, interval, n_bars=bars)
8. If df is None or empty: exit with error
9. Print: "Fetched N rows: <start_date> → <end_date>"
10. Save to tools/data/<out> as CSV (index=True so datetime is included)
11. Print: "Saved to tools/data/<out>"
```

## Output CSV Format

```
datetime,open,high,low,close,volume
2025-10-01 09:30:00,5120.1,5128.0,5118.2,5125.8,121000
2025-10-01 09:35:00,5125.8,5132.4,5123.1,5130.2,98000
```

## Files to Create / Modify

| File | Change |
|---|---|
| `tools/tv_export.py` | New script |
| `.gitignore` | Add `tools/data/` |

## Done When

- `python tv_export.py --symbol SPX --exchange INDEX --timeframe 5 --bars 100 --out test.csv`
  prints row count + date range and creates `tools/data/test.csv`
- Unsupported timeframe prints a clear error and exits
- Missing credentials print a clear error and exit
