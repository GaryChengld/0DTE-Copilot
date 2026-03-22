# Task 01 — Initialize Server Application ✅ COMPLETED (2026-03-22)

Scaffold the backend Node.js/TypeScript application inside the `server/` directory.

## Goal

Set up a working, runnable Express server with all dependencies installed, TypeScript configured, Prisma initialized, and a clean folder structure ready for feature development.

## Steps

1. **Initialize npm project** inside `server/`
   - Create `package.json` with `name: "0dte-copilot-server"`, `type: "module"`
   - Add scripts: `dev` (tsx watch), `build` (tsc), `start` (node dist)

2. **Install dependencies**
   - Production: `express`, `socket.io`, `node-cron`, `yahoo-finance2`, `@google/generative-ai`, `@prisma/client`, `dotenv`
   - Dev: `typescript`, `tsx`, `@types/express`, `@types/node`, `@types/node-cron`, `prisma`

3. **Configure TypeScript**
   - Create `tsconfig.json` targeting ES2022, `NodeNext` modules, output to `dist/`
   - Strict mode enabled

4. **Initialize Prisma**
   - Run `npx prisma init --datasource-provider sqlite`
   - Define initial schema models: `MarketSnapshot`, `AiAdvice`, `TradeLog`

5. **Create folder structure**
   ```
   server/
   ├── src/
   │   ├── index.ts          # Express + Socket.io entry point
   │   ├── config.ts         # Env var loading via dotenv
   │   ├── routes/           # Express route handlers
   │   ├── services/         # Business logic (ingestion, vwap, ai, etc.)
   │   ├── jobs/             # node-cron scheduled jobs
   │   └── db/               # Prisma client singleton
   ├── prisma/
   │   └── schema.prisma
   ├── .env.example
   ├── package.json
   └── tsconfig.json
   ```

6. **Create `.env.example`** with required variables:
   ```
   GEMINI_API_KEY=
   DATABASE_URL=file:./dev.db
   PORT=3001
   ```

7. **Verify** the server starts with `npm run dev` and listens on `PORT`

## Done When

- `npm run dev` starts without errors
- Prisma client generates successfully
- Folder structure matches the layout above
- `.env.example` is committed; `.env` is gitignored
