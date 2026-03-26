import cron from "node-cron";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createLLMProvider } from "./llm/index.js";
import type { LLMProvider } from "./llm/index.js";
import { getTodayMarketSnapshots } from "../db/ingestionRepository.js";
import { findOpenTrades } from "../db/tradeRepository.js";
import { isMarketHours } from "../utils/marketHours.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadPrompt(): string {
  return readFileSync(join(__dirname, "../prompts/strategicPrompt.md"), "utf-8");
}

interface AISessionState {
  status: "uninitialized" | "ok" | "error";
  provider: string;
  lastMessageAt: string | null;
  lastError: string | null;
}

const sessionState: AISessionState = {
  status: "uninitialized",
  provider: "",
  lastMessageAt: null,
  lastError: null,
};

export function getAISessionState(): AISessionState {
  return { ...sessionState };
}

export function isSessionAvailable(): boolean {
  return sessionState.status === "ok";
}

let provider: LLMProvider | null = null;
let isReplaying = false;

async function replayTodayHistory(): Promise<void> {
  const [snapshots, openPositions] = await Promise.all([
    getTodayMarketSnapshots(),
    findOpenTrades(),
  ]);

  if (snapshots.length === 0) return;

  const body = snapshots
    .map((snap) => JSON.stringify({ market_data: snap.marketData, open_positions: openPositions }))
    .join("\n---\n");

  const message =
    `[HISTORY REPLAY] The following are today's market snapshots in chronological order. Use them as context only.\n\n${body}`;

  isReplaying = true;
  try {
    await sendToAI(message);
  } finally {
    isReplaying = false;
  }

  console.log(`[aiSession] replayed ${snapshots.length} snapshot(s) as history`);
}

async function createSession(withHistory: boolean): Promise<void> {
  provider = createLLMProvider();
  sessionState.provider = process.env.LLM_PROVIDER ?? "gemini";
  sessionState.status = "uninitialized";
  const initResponse = await provider.init(loadPrompt());
  if (initResponse) console.log("[AI response]\n", initResponse);
  if (withHistory && isMarketHours()) await replayTodayHistory();
}

export async function initAISession(): Promise<void> {
  await createSession(true);
  console.log(`[aiSession] initialized with provider: ${process.env.LLM_PROVIDER ?? "gemini"}`);
}

export async function sendToAI(message: string): Promise<string> {
  if (!provider) throw new Error("AI session not initialized");

  const send = () => provider!.send(message);
  const log = (response: string) => {
    if (!isReplaying) console.log("[AI response]\n", response);
  };

  const succeed = (response: string) => {
    if (!isReplaying) {
      sessionState.status = "ok";
      sessionState.lastMessageAt = new Date().toISOString();
      sessionState.lastError = null;
    }
    log(response);
    return response;
  };

  const fail = (err: unknown) => {
    if (!isReplaying) {
      sessionState.status = "error";
      sessionState.lastMessageAt = new Date().toISOString();
      sessionState.lastError = err instanceof Error ? err.message : String(err);
    }
  };

  try {
    return succeed(await send());
  } catch {
    try {
      return succeed(await send());
    } catch (retryErr) {
      if (isReplaying) throw retryErr;
      console.error("[aiSession] retry failed, restarting session:", retryErr);
      await restartAISession();
      try {
        return succeed(await send());
      } catch (finalErr) {
        fail(finalErr);
        throw finalErr;
      }
    }
  }
}

export async function restartAISession(): Promise<void> {
  console.log("[aiSession] restarting session and replaying history...");
  await createSession(true);
}

export function scheduleDailyReset(): void {
  cron.schedule(
    "0 8 * * 1-5",
    async () => {
      console.log("[aiSession] daily reset at 8:00 AM ET");
      await createSession(false);
    },
    { timezone: "America/New_York" }
  );
  console.log("[aiSession] daily reset scheduled at 8:00 AM ET (Mon–Fri)");
}
