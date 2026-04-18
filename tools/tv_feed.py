"""
TradingView Internals Feeder
Polls VIX, $ADD, $TICK from TradingView and POSTs to the local server every N minutes.

Usage:
    python tv_feed.py              # polls every 5 minutes
    python tv_feed.py --interval 1 # polls every 1 minute
    python tv_feed.py --server http://localhost:3001
"""

import argparse
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from zoneinfo import ZoneInfo

import requests
from dotenv import load_dotenv
from tvDatafeed import Interval, TvDatafeed

load_dotenv()

# ---------------------------------------------------------------------------
# Interval mapping
# ---------------------------------------------------------------------------

INTERVAL_MAP = {
    1:  Interval.in_1_minute,
    3:  Interval.in_3_minute,
    5:  Interval.in_5_minute,
    15: Interval.in_15_minute,
    30: Interval.in_30_minute,
    45: Interval.in_45_minute,
}

# ---------------------------------------------------------------------------
# Symbols to fetch
# ---------------------------------------------------------------------------

SYMBOLS = [
    ("vix",  "VIX",  "CBOE"),
    ("add",  "ADD",  "USI"),
    ("tick", "TICK", "USI"),
]

ET = ZoneInfo("America/New_York")

# Seconds after each interval boundary to wake up.
# TradingView needs a moment to publish the freshly closed bar; :10 is enough.
WAKE_OFFSET_SECONDS = 10


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def now_et() -> datetime:
    return datetime.now(ET)


def et_time_str() -> str:
    return now_et().strftime("%H:%M")


def sleep_until_next_interval(interval_minutes: int) -> None:
    """Sleep until 10 seconds after the next clock-aligned interval boundary."""
    now = now_et()
    seconds_past_hour = now.minute * 60 + now.second + now.microsecond / 1_000_000
    interval_seconds = interval_minutes * 60
    seconds_until_next = interval_seconds - (seconds_past_hour % interval_seconds) + WAKE_OFFSET_SECONDS
    next_minute = (now.minute // interval_minutes * interval_minutes + interval_minutes) % 60
    print(f"  Sleeping {seconds_until_next:.0f}s until next :{next_minute:02d}:{WAKE_OFFSET_SECONDS:02d}...")
    time.sleep(seconds_until_next)


def fetch_close(tv: TvDatafeed, symbol: str, exchange: str) -> float:
    """Fetch the latest 1-minute bar and return its close value.

    Always use 1-minute bars regardless of poll interval so we get the most
    recent reading (at most ~1 minute stale) rather than the last completed
    N-minute bar which can lag by up to 2× the poll interval.
    """
    df = tv.get_hist(symbol=symbol, exchange=exchange, interval=Interval.in_1_minute, n_bars=2)
    if df is None or len(df) < 1:
        raise ValueError(f"Insufficient data for {symbol}")
    # iloc[-1] is the currently forming bar — use it for the most current reading
    # even if the candle hasn't closed yet.
    return float(df["close"].iloc[-1])


def fetch_all(tv: TvDatafeed) -> dict:
    """Fetch VIX, ADD, TICK in parallel. Returns dict with available values."""
    results = {}
    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = {
            executor.submit(fetch_close, tv, symbol, exchange): key
            for key, symbol, exchange in SYMBOLS
        }
        for future in as_completed(futures):
            key = futures[future]
            try:
                results[key] = future.result()
            except Exception as e:
                print(f"  WARNING: failed to fetch {key}: {e}")
    return results


def post_to_server(server_url: str, time_str: str, data: dict) -> None:
    """POST internals to /api/other_indexes."""
    payload = {"time": time_str, **data}
    response = requests.post(f"{server_url}/api/other_indexes", json=payload, timeout=10)
    response.raise_for_status()
    status = response.status_code

    parts = [f"VIX={data['vix']:.2f}" if "vix" in data else None,
             f"ADD={data['add']:.0f}"  if "add" in data else None,
             f"TICK={data['tick']:.0f}" if "tick" in data else None]
    values = "  ".join(p for p in parts if p)
    print(f"[{time_str} ET] {values}  → {status} OK")


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Poll TradingView internals and feed to local server")
    parser.add_argument("--interval", type=int, default=5, help="Polling interval in minutes (default: 5)")
    parser.add_argument("--server", type=str, default=None, help="Server base URL (default: from .env or http://localhost:3001)")
    args = parser.parse_args()

    if args.interval not in INTERVAL_MAP:
        print(f"ERROR: --interval must be one of {sorted(INTERVAL_MAP.keys())}")
        sys.exit(1)

    username = os.getenv("TV_USERNAME")
    password = os.getenv("TV_PASSWORD")
    server_url = args.server or os.getenv("SERVER_URL", "http://localhost:3001")

    if not username or not password:
        print("ERROR: TV_USERNAME and TV_PASSWORD must be set in .env or environment")
        sys.exit(1)

    interval = INTERVAL_MAP[args.interval]

    print(f"Connecting to TradingView as {username}...")
    tv = TvDatafeed(username=username, password=password)
    print(f"Connected. Polling every {args.interval}m → {server_url}/api/other_indexes")
    print("Press Ctrl+C to stop.\n")

    try:
        sleep_until_next_interval(args.interval)
    except KeyboardInterrupt:
        print("\nStopped.")
        sys.exit(0)

    while True:
        try:
            data = fetch_all(tv)
            if not data:
                print(f"  WARNING: no data fetched, skipping this interval")
            else:
                post_to_server(server_url, et_time_str(), data)
        except requests.exceptions.RequestException as e:
            print(f"  WARNING: HTTP error posting to server: {e}")
        except Exception as e:
            print(f"  WARNING: unexpected error: {e}")

        try:
            sleep_until_next_interval(args.interval)
        except KeyboardInterrupt:
            print("\nStopped.")
            sys.exit(0)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nStopped.")
        sys.exit(0)
