import cron from "node-cron";
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createLLMProvider } from "./llm/index.js";
import { config } from "../config.js";
import type { LLMProvider } from "./llm/index.js";
import { getTodaySessionSummary, createAiAdvice } from "../db/ingestionRepository.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadPrompt(): string {
  return readFileSync(join(__dirname, "../prompts", config.promptFile), "utf-8");
}

function loadSummaryPrompt(): string {
  return readFileSync(join(__dirname, "../prompts/summaryPrompt.md"), "utf-8");
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
let messageCount = 0;

async function createSession(): Promise<void> {
  provider = createLLMProvider();
  sessionState.provider = process.env.LLM_PROVIDER ?? "gemini";
  sessionState.status = "uninitialized";
  messageCount = 0;

  const initResponse = await provider.init(loadPrompt());
  sessionState.status = "ok";
  sessionState.lastMessageAt = new Date().toISOString();
  sessionState.lastError = null;
  if (initResponse) console.log("[AI response]\n", initResponse);

  const summary = await getTodaySessionSummary();
  if (summary) {
    console.log("[aiSession] injecting today's session summary as context");
    await sendToAI(`[SESSION CONTEXT] ${summary}`);
  }
}

export async function initAISession(): Promise<void> {
  await createSession();
  console.log(`[aiSession] initialized with provider: ${process.env.LLM_PROVIDER ?? "gemini"}`);
}

export async function sendToAI(message: string): Promise<string> {
  if (!provider) throw new Error("AI session not initialized");

  const send = () => provider!.send(message);
  const log = (response: string) => {
    console.log("[AI response]\n", response);
  };

  const succeed = (response: string) => {
    sessionState.status = "ok";
    sessionState.lastMessageAt = new Date().toISOString();
    sessionState.lastError = null;
    log(response);
    return response;
  };

  const fail = (err: unknown) => {
    sessionState.status = "error";
    sessionState.lastMessageAt = new Date().toISOString();
    sessionState.lastError = err instanceof Error ? err.message : String(err);
  };

  let response: string;
  try {
    response = succeed(await send());
  } catch {
    try {
      response = succeed(await send());
    } catch (retryErr) {
      console.error("[aiSession] retry failed, restarting session:", retryErr);
      await restartAISession();
      try {
        response = succeed(await send());
      } catch (finalErr) {
        fail(finalErr);
        throw finalErr;
      }
    }
  }

  messageCount++;
  if (messageCount >= config.sessionSummaryInterval) {
    console.log(`[aiSession] message count reached ${messageCount}, triggering auto-restart`);
    await restartAISession();
  }

  return response!;
}

export async function restartAISession(): Promise<void> {
  console.log("[aiSession] generating session summary...");
  try {
    const summary = await provider!.send(loadSummaryPrompt());
    await createAiAdvice({ source: "session_summary", prompt: null, response: summary, provider: config.llm.provider });
    console.log("[aiSession] session summary stored, restarting...");
  } catch (err) {
    console.warn("[aiSession] failed to generate session summary, restarting without context:", err instanceof Error ? err.message : err);
  }
  await createSession();
}

export function scheduleDailyReset(): void {
  cron.schedule(
    "0 8 * * 1-5",
    async () => {
      console.log("[aiSession] daily reset at 8:00 AM ET");
      await createSession();
    },
    { timezone: "America/New_York" }
  );
  console.log("[aiSession] daily reset scheduled at 8:00 AM ET (Mon–Fri)");
}
