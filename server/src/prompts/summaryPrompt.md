[SESSION SUMMARY REQUEST] Summarize today's trading session context in compact JSON.
Return ONLY raw JSON. Exclude open positions. All string values must be in English.

```json
{
  "session_date": "YYYY-MM-DD",
  "regime": "...",
  "opening_pattern": "...",
  "bias": "Bullish",
  "weighted_score": 0.3,
  "price_action": {
    "previous_close": 5200.1,
    "current_price": 5122.3,
    "trend": "Strong Bullish | Neutral | Weak Bearish",
    "structure": "Higher Highs | Lower Lows | Inside Range",
    "last_major_move": "Sharp drop at 10:30 on high volume"
  },
  "vix_dynamics": {
    "current_vix": 14.5,
    "trend": "Crushing | Rising | Stable",
    "relative_to_iv": "..."
  },
  "add_dynamics": {
    "opening_add": 0,
    "current_add": 0,
    "trend": "Improving | Deteriorating | Stable",
    "breadth_signal": "Bullish | Bearish | Neutral"
  },
  "key_levels": {
    "nearest_resistance": 5130.0,
    "nearest_support": 5115.0,
    "today_high": 5130.2,
    "today_low": 5105.8,
    "current_vwap_pos": "Above/Below",
    "gex_flip": 0,
    "call_wall": 0,
    "put_wall": 0,
    "ma_context": "Testing 200MA"
  },
  "sentiment_signals": { "tick_breadth": "...", "internals": "..." },
  "key_news": ["Fed holds rates steady", "CPI in line with expectations"],
  "setups_considered": ["Bull Put Spread"],
  "notes": "Price is approaching the 5130 Resistance/Call Wall; watch for rejection."
}
```
