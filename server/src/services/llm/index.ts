import { config } from "../../config.js";
import { GeminiProvider } from "./GeminiProvider.js";
import { OpenAIProvider } from "./OpenAIProvider.js";
import { ClaudeProvider } from "./ClaudeProvider.js";
import type { LLMProvider } from "./LLMProvider.js";

// To add a new provider:
// 1. Create src/services/llm/NewProvider.ts implementing LLMProvider
// 2. Add its name to LLMProviderName
// 3. Add it to PROVIDERS map
// 4. Add its apiKey + model block to config.ts and .env.example
export type LLMProviderName = "gemini" | "openai" | "claude";

const PROVIDERS: Record<LLMProviderName, () => LLMProvider> = {
  gemini: () => new GeminiProvider(),
  openai: () => new OpenAIProvider(),
  claude: () => new ClaudeProvider(),
};

export function createLLMProvider(): LLMProvider {
  const name = config.llm.provider as LLMProviderName;
  const factory = PROVIDERS[name] ?? PROVIDERS["gemini"];
  return factory();
}

export type { LLMProvider };
