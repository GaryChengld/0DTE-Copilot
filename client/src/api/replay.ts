export async function getReplayPayload(date: string): Promise<unknown> {
  const res = await fetch(`/api/ai/replay/message?date=${encodeURIComponent(date)}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
