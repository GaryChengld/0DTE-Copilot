export interface AiAdvice {
  id: number;
  timestamp: string;
  source: string;
  prompt: string | null;
  response: string;
  provider: string;
}

export async function getAiAdvices(): Promise<AiAdvice[]> {
  const res = await fetch("/api/ai-advices");
  return res.json();
}

export async function sendChat(message: string): Promise<{ response: string }> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  return res.json();
}

export async function triggerAnalysis(userNotes?: string): Promise<{ response: string }> {
  const res = await fetch("/api/ai/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userNotes ? { user_notes: userNotes } : {}),
  });
  return res.json();
}
