import "dotenv/config";

export const config = {
  port: parseInt(process.env.PORT ?? "3001", 10),
  databaseUrl: process.env.DATABASE_URL ?? "file:./dev.db",
  promptFile: process.env.PROMPT_FILE ?? "strategicPrompt.md",
  sessionSummaryInterval: parseInt(process.env.SESSION_SUMMARY_INTERVAL ?? "20", 10),
  finnhubApiKey: process.env.FINNHUB_API_KEY ?? "",
  llm: {
    provider: process.env.LLM_PROVIDER ?? "gemini",
    gemini: {
      apiKey: process.env.GEMINI_API_KEY ?? "",
      model: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY ?? "",
      model: process.env.OPENAI_MODEL ?? "gpt-4o",
    },
    claude: {
      apiKey: process.env.ANTHROPIC_API_KEY ?? "",
      model: process.env.CLAUDE_MODEL ?? "claude-opus-4-6",
    },
  },
};
