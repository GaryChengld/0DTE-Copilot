# 0DTE SPX Copilot

An intelligent, real-time trading decision-support system designed for SPX 0DTE options strategies (Credit Spreads). This tool integrates live market data, technical internals, and the Gemini 1.5 Pro AI model to provide actionable risk assessment and trade management advice.

## 🚀 Technical Stack

- **Runtime:** Node.js (v20+) with **TypeScript**.
- **Frontend:** React (Vite) + Tailwind CSS + Lucide Icons.
- **Backend:** Express.js + `node-cron` for scheduled data ingestion.
- **Database:** **SQLite** (Local file-based) with **Prisma ORM**.
- **Real-time:** **Socket.io** for low-latency data streaming between Backend and UI.
- **AI Integration:** Google Gemini SDK (Single persistent Chat Session).
- **Data Source:** `yahoo-finance2` (5-minute OHLC intervals).

## 🧠 Core Trading Logic

The system follows a strict hierarchical decision-making process:
1.  **VWAP (The Anchor):** Intraday VWAP is calculated cumulatively from 09:30 AM EST. Price relation to VWAP determines the primary bias (Bullish/Bearish).
2.  **Market Internals:** Real-time monitoring of **$ADD** (Advance-Decline) and **$TICK** for trend confirmation and exhaustion signals.
3.  **Gamma Map:** Integration of pre-defined Gamma levels (Call Wall, Zero Gamma, Put Wall) to identify high-probability reversal or breakout zones.
4.  **AI Orchestration:** A persistent Gemini session maintains the context of the entire trading day, shifting from **Observation Mode** (seeking entries) to **Management Mode** (protecting active positions).

## 🛠️ Architecture Overview

- **Data Ingestion Engine:** Fetches SPX OHLC, VIX, ADD, and TICK every 5 minutes.
- **VWAP Calculator:** Computes real-time VWAP using cumulative `(Price * Volume) / Volume`.
- **Persistence Layer:** All snapshots, AI advice, and trade logs are stored in SQLite via Prisma for disaster recovery and weekend review.
- **AI Copilot:** Processes incoming snapshots and returns a "Market Vibe," win probabilities, and specific adjustment advice (Hold/TP/SL).
