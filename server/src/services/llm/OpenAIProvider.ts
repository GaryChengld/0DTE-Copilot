import OpenAI from "openai";
import { config } from "../../config.js";
import type { LLMProvider } from "./LLMProvider.js";

type Message = { role: "system" | "user" | "assistant"; content: string };

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI | null = null;
  private messages: Message[] = [];

  async init(systemPrompt: string): Promise<string> {
    this.client = new OpenAI({ apiKey: config.llm.openai.apiKey });
    this.messages = [];
    if (systemPrompt.trim()) {
      this.messages.push({ role: "system", content: systemPrompt });
    }
    return "";
  }

  async send(message: string): Promise<string> {
    if (!this.client) throw new Error("OpenAI not initialized");
    this.messages.push({ role: "user", content: message });
    const res = await this.client.chat.completions.create({
      model: config.llm.openai.model,
      messages: this.messages,
    });
    const reply = res.choices[0]?.message?.content ?? "";
    this.messages.push({ role: "assistant", content: reply });
    return reply;
  }

  async reset(systemPrompt: string): Promise<string> {
    this.messages = [];
    return this.init(systemPrompt);
  }
}
