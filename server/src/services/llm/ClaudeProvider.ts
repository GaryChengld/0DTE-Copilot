import Anthropic from "@anthropic-ai/sdk";
import { config } from "../../config.js";
import type { LLMProvider } from "./LLMProvider.js";

type Message = { role: "user" | "assistant"; content: string };

export class ClaudeProvider implements LLMProvider {
  private client: Anthropic | null = null;
  private systemPrompt: string = "";
  private messages: Message[] = [];

  async init(systemPrompt: string): Promise<string> {
    this.client = new Anthropic({ apiKey: config.llm.claude.apiKey });
    this.systemPrompt = systemPrompt;
    this.messages = [];
    return "";
  }

  async send(message: string): Promise<string> {
    if (!this.client) throw new Error("Claude not initialized");
    this.messages.push({ role: "user", content: message });
    const res = await this.client.messages.create({
      model: config.llm.claude.model,
      max_tokens: 4096,
      system: this.systemPrompt,
      messages: this.messages,
    });
    const reply = res.content[0]?.type === "text" ? res.content[0].text : "";
    this.messages.push({ role: "assistant", content: reply });
    return reply;
  }

  async reset(systemPrompt: string): Promise<string> {
    this.messages = [];
    return this.init(systemPrompt);
  }
}
