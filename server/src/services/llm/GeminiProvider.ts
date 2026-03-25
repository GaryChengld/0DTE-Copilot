import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ChatSession } from "@google/generative-ai";
import { config } from "../../config.js";
import type { LLMProvider } from "./LLMProvider.js";

export class GeminiProvider implements LLMProvider {
  private chat: ChatSession | null = null;

  async init(systemPrompt: string): Promise<string> {
    const genAI = new GoogleGenerativeAI(config.llm.gemini.apiKey);
    const model = genAI.getGenerativeModel({ model: config.llm.gemini.model });
    this.chat = model.startChat();
    if (systemPrompt.trim()) {
      const result = await this.chat.sendMessage(systemPrompt);
      return result.response.text();
    }
    return "";
  }

  async send(message: string): Promise<string> {
    if (!this.chat) throw new Error("Gemini session not initialized");
    const result = await this.chat.sendMessage(message);
    return result.response.text();
  }

  async reset(systemPrompt: string): Promise<string> {
    this.chat = null;
    return this.init(systemPrompt);
  }
}
