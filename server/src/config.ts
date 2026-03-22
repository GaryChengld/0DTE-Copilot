import "dotenv/config";

export const config = {
  port: parseInt(process.env.PORT ?? "3001", 10),
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "file:./dev.db",
};
