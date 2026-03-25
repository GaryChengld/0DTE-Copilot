export interface LLMProvider {
  init(systemPrompt: string): Promise<string>;
  send(message: string): Promise<string>;
  reset(systemPrompt: string): Promise<string>;
}
