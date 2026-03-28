[SESSION SUMMARY REQUEST] Summarize today's trading session context in compact JSON.
Exclude open positions — they are sent separately every 5 minutes.

{
  "session_date": "YYYY-MM-DD",
  "regime": "...",
  "opening_pattern": "...",
  "bias": "Bullish | Bearish | Neutral",
  "weighted_score": 0.0,
  "vix_dynamics": {
    "trend": "...",
    "relative_to_iv": "..."
  },
  "key_levels": { "gex_flip": 0, "call_wall": 0, "put_wall": 0 },
  "sentiment_signals": {
    "tick_breadth": "...",
    "internals": "..."
  },
  "setups_considered": ["..."],
  "notes": "..."
}
