"""
TradingView History Exporter
Exports historical OHLCV candle data from TradingView to a CSV file.

Usage:
    python tv_export.py --symbol SPX --exchange INDEX --timeframe 5 --bars 20000 --out spx_5m.csv
    python tv_export.py --symbol SPY --exchange AMEX --timeframe 1d --bars 300 --out spy_daily.csv

Output is saved to tools/data/<filename>.
"""

import argparse
import os
import sys
from pathlib import Path

import pandas_ta as ta
from dotenv import load_dotenv
from tvDatafeed import Interval, TvDatafeed

load_dotenv()

# ---------------------------------------------------------------------------
# Timeframe mapping
# ---------------------------------------------------------------------------

INTERVAL_MAP = {
    "1":  Interval.in_1_minute,
    "3":  Interval.in_3_minute,
    "5":  Interval.in_5_minute,
    "15": Interval.in_15_minute,
    "30": Interval.in_30_minute,
    "45": Interval.in_45_minute,
    "1h": Interval.in_1_hour,
    "2h": Interval.in_2_hour,
    "4h": Interval.in_4_hour,
    "1d": Interval.in_daily,
    "1w": Interval.in_weekly,
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Export historical candle data from TradingView to CSV")
    parser.add_argument("--symbol",    required=True, help="Ticker symbol, e.g. SPX, SPY, QQQ")
    parser.add_argument("--exchange",  required=True, help="Exchange, e.g. INDEX, AMEX, NASDAQ, USI")
    parser.add_argument("--timeframe", required=True, help="Timeframe: 1 3 5 15 30 45 1h 2h 4h 1d 1w")
    parser.add_argument("--bars",      required=True, type=int, help="Number of candles to fetch")
    parser.add_argument("--out",       required=True, help="Output filename (saved under tools/data/)")
    args = parser.parse_args()

    # Validate timeframe
    if args.timeframe not in INTERVAL_MAP:
        print(f"ERROR: unsupported timeframe '{args.timeframe}'. Valid options: {', '.join(INTERVAL_MAP.keys())}")
        sys.exit(1)

    # Load credentials
    username = os.getenv("TV_USERNAME")
    password = os.getenv("TV_PASSWORD")
    if not username or not password:
        print("ERROR: TV_USERNAME and TV_PASSWORD must be set in .env")
        sys.exit(1)

    # Ensure output directory exists
    data_dir = Path(__file__).parent / "data"
    data_dir.mkdir(exist_ok=True)
    out_path = data_dir / args.out

    # Connect
    print(f"Connecting to TradingView as {username}...")
    tv = TvDatafeed(username=username, password=password)

    # Fetch
    interval = INTERVAL_MAP[args.timeframe]
    print(f"Fetching {args.bars} bars of {args.symbol} ({args.exchange}) @ {args.timeframe}...")
    df = tv.get_hist(symbol=args.symbol, exchange=args.exchange, interval=interval, n_bars=args.bars)

    if df is None or df.empty:
        print("ERROR: no data returned — check symbol and exchange")
        sys.exit(1)

    start = df.index[0]
    end = df.index[-1]
    print(f"Fetched {len(df)} rows: {start} → {end}")

    # Drop symbol column if present
    df = df.drop(columns=["symbol"], errors="ignore")

    # Compute indicators (NaN for rows without enough history → saved as blank)
    close, high, low = df["close"], df["high"], df["low"]

    df["rsi_14"] = ta.rsi(close, length=14)

    for p in [5, 10, 20, 50, 100, 200]:
        df[f"sma_{p}"] = ta.sma(close, length=p)
        df[f"ema_{p}"] = ta.ema(close, length=p)

    df["atr_14"] = ta.atr(high, low, close, length=14)

    macd_df = ta.macd(close)  # returns DataFrame with 3 columns
    if macd_df is not None and not macd_df.empty:
        df["macd"]        = macd_df.iloc[:, 0]  # MACD line
        df["macd_signal"] = macd_df.iloc[:, 2]  # Signal line
        df["macd_hist"]   = macd_df.iloc[:, 1]  # Histogram

    # Save
    df.to_csv(out_path)
    print(f"Saved to {out_path}")


if __name__ == "__main__":
    main()
