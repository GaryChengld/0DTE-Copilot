"""
TradingView Internals Feeder
Polls VIX, $ADD, $TICK from TradingView and POSTs to the local server.

Schedule (ET):
  Pre-market  08:00:10 – 09:25   VIX only, every 15 minutes
  Market      09:30:10 – 16:05   VIX + ADD + TICK, every --interval minutes (default 5)
  All other times / non-market days: sleeps until next active session

Usage:
    python tv_feed.py              # polls every 5 minutes during market
    python tv_feed.py --interval 1
    python tv_feed.py --server http://localhost:3001
"""

from __future__ import annotations

import argparse
import os
import sys
import time as time_module
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import requests
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

VALID_INTERVALS = {1, 3, 5, 15, 30, 45}

SYMBOLS_ALL = [
    ("vix",  "VIX",  "CBOE"),
    ("add",  "ADD",  "USI"),
    ("tick", "TICK", "USI"),
]

SYMBOLS_PRE_MARKET = [
    ("vix",  "VIX",  "CBOE"),
]

ET = ZoneInfo("America/New_York")
WAKE_OFFSET_SECONDS = 10

NYSE_HOLIDAYS: set[date] = {
    # 2025
    date(2025, 1, 1), date(2025, 1, 20), date(2025, 2, 17), date(2025, 4, 18),
    date(2025, 5, 26), date(2025, 7, 4), date(2025, 9, 1), date(2025, 11, 27),
    date(2025, 12, 25),
    # 2026
    date(2026, 1, 1), date(2026, 1, 19), date(2026, 2, 16), date(2026, 4, 3),
    date(2026, 5, 25), date(2026, 7, 3), date(2026, 9, 7), date(2026, 11, 26),
    date(2026, 12, 25),
}

# ---------------------------------------------------------------------------
# Market calendar
# ---------------------------------------------------------------------------

def is_market_day(d: date) -> bool:
    return d.weekday() < 5 and d not in NYSE_HOLIDAYS


def next_market_day(d: date) -> date:
    d += timedelta(days=1)
    while not is_market_day(d):
        d += timedelta(days=1)
    return d


def get_session(now: datetime) -> str:
    """Return 'pre_market', 'market', or 'closed'."""
    if not is_market_day(now.date()):
        return "closed"
    mins = now.hour * 60 + now.minute
    if 8 * 60 <= mins < 9 * 60 + 25:
        return "pre_market"
    if 9 * 60 + 30 <= mins < 16 * 60 + 5:
        return "market"
    return "closed"


def next_session_start(now: datetime) -> datetime:
    """ET datetime of the next active session boundary to sleep until."""
    d = now.date()
    mins = now.hour * 60 + now.minute

    if is_market_day(d):
        # Before pre-market: wake at 08:00:10 today
        if mins < 8 * 60:
            return datetime(d.year, d.month, d.day, 8, 0, WAKE_OFFSET_SECONDS, tzinfo=ET)
        # In the 09:25–09:30 gap: wake at market open
        if 9 * 60 + 25 <= mins < 9 * 60 + 30:
            return datetime(d.year, d.month, d.day, 9, 30, WAKE_OFFSET_SECONDS, tzinfo=ET)

    # After market close or non-market day: next market day's pre-market
    nd = next_market_day(d)
    return datetime(nd.year, nd.month, nd.day, 8, 0, WAKE_OFFSET_SECONDS, tzinfo=ET)

# ---------------------------------------------------------------------------
# Time helpers
# ---------------------------------------------------------------------------

def now_et() -> datetime:
    return datetime.now(ET)


def et_time_str() -> str:
    return now_et().strftime("%H:%M")


def sleep_until(target: datetime) -> None:
    delta = (target - now_et()).total_seconds()
    if delta > 1:
        print(f"  Sleeping until {target.strftime('%Y-%m-%d %H:%M:%S')} ET ({delta / 60:.0f} min)...")
        time_module.sleep(delta)


def sleep_until_next_interval(interval_minutes: int) -> None:
    """Sleep until 10 seconds after the next clock-aligned interval boundary."""
    now = now_et()
    seconds_past_hour = now.minute * 60 + now.second + now.microsecond / 1_000_000
    interval_seconds = interval_minutes * 60
    seconds_until_next = interval_seconds - (seconds_past_hour % interval_seconds) + WAKE_OFFSET_SECONDS
    next_minute = (now.minute // interval_minutes * interval_minutes + interval_minutes) % 60
    print(f"  Sleeping {seconds_until_next:.0f}s until next :{next_minute:02d}:{WAKE_OFFSET_SECONDS:02d}...")
    time_module.sleep(seconds_until_next)

# ---------------------------------------------------------------------------
# TvDatafeed fetching
# ---------------------------------------------------------------------------

def fetch_latest(tv: TvDatafeed, symbol: str, exchange: str) -> tuple[str, float]:
    """Fetch the latest completed 1-minute bar; return (HH:MM ET, close).

    TvDatafeed index symbols have a ~5-7 min data delay, so records are stamped
    with the bar's own timestamp rather than wall-clock time.
    """
    df = tv.get_hist(symbol=symbol, exchange=exchange, interval=Interval.in_1_minute, n_bars=2)
    if df is None or len(df) < 1:
        raise ValueError(f"Insufficient data for {symbol}")
    bar = df.iloc[-1]
    # tvDatafeed returns naive timestamps already in ET
    bar_time_et = bar.name.strftime("%H:%M")
    return bar_time_et, float(bar["close"])


def fetch_symbols(tv: TvDatafeed, symbols: list) -> tuple[str, dict]:
    """Fetch given symbols in parallel; return (bar_time_et, values_dict)."""
    bar_times: list[str] = []
    values: dict = {}
    with ThreadPoolExecutor(max_workers=len(symbols)) as executor:
        futures = {
            executor.submit(fetch_latest, tv, symbol, exchange): key
            for key, symbol, exchange in symbols
        }
        for future in as_completed(futures):
            key = futures[future]
            try:
                bar_time, close = future.result()
                bar_times.append(bar_time)
                values[key] = close
            except Exception as e:
                print(f"  WARNING: failed to fetch {key}: {e}")
    bar_time_et = max(bar_times) if bar_times else et_time_str()
    return bar_time_et, values


def post_to_server(server_url: str, time_str: str, data: dict) -> None:
    payload = {"time": time_str, **data}
    response = requests.post(f"{server_url}/api/other_indexes", json=payload, timeout=10)
    response.raise_for_status()

    parts = [f"VIX={data['vix']:.2f}"  if "vix"  in data else None,
             f"ADD={data['add']:.0f}"   if "add"  in data else None,
             f"TICK={data['tick']:.0f}" if "tick" in data else None]
    print(f"[{time_str} ET] {'  '.join(p for p in parts if p)}  → {response.status_code} OK")

# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def main():
    print(f"tv_feed starting at {now_et().strftime('%Y-%m-%d %H:%M:%S')} ET — loading dependencies...")
    global Interval, TvDatafeed  # noqa: PLW0603 — deferred import; names must be module-global for fetch_latest
    from tvDatafeed import Interval, TvDatafeed
    parser = argparse.ArgumentParser(description="Poll TradingView internals and feed to local server")
    parser.add_argument("--interval", type=int, default=5,
                        help="Market-hours polling interval in minutes (default: 5)")
    parser.add_argument("--server", type=str, default=None,
                        help="Server base URL (default: from .env or http://localhost:3001)")
    args = parser.parse_args()

    if args.interval not in VALID_INTERVALS:
        print(f"ERROR: --interval must be one of {sorted(VALID_INTERVALS)}")
        sys.exit(1)

    username = os.getenv("TV_USERNAME")
    password = os.getenv("TV_PASSWORD")
    server_url = args.server or os.getenv("SERVER_URL", "http://localhost:3001")

    if not username or not password:
        print("ERROR: TV_USERNAME and TV_PASSWORD must be set in .env or environment")
        sys.exit(1)

    print(f"Connecting to TradingView as {username}...")
    tv = TvDatafeed(username=username, password=password)
    print(f"Connected. Market interval: {args.interval}m → {server_url}/api/other_indexes")
    print("Press Ctrl+C to stop.\n")

    while True:
        try:
            now = now_et()
            session = get_session(now)

            if session == "closed":
                sleep_until(next_session_start(now))
                continue

            if session == "pre_market":
                bar_time, data = fetch_symbols(tv, SYMBOLS_PRE_MARKET)
                if data:
                    print(f"  [pre-market] bar={bar_time} wall={et_time_str()}")
                    post_to_server(server_url, bar_time, data)
                else:
                    print("  WARNING: no pre-market data, skipping")
                sleep_until_next_interval(15)
                continue

            # session == "market"
            bar_time, data = fetch_symbols(tv, SYMBOLS_ALL)
            if data:
                print(f"  [market] bar={bar_time} wall={et_time_str()}")
                post_to_server(server_url, bar_time, data)
            else:
                print("  WARNING: no data fetched, skipping this interval")
            sleep_until_next_interval(args.interval)

        except requests.exceptions.RequestException as e:
            print(f"  WARNING: HTTP error: {e}")
            time_module.sleep(30)
        except KeyboardInterrupt:
            print("\nStopped.")
            sys.exit(0)
        except Exception as e:
            print(f"  WARNING: unexpected error: {e}")
            time_module.sleep(30)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nStopped.")
        sys.exit(0)
