export async function fetchNewsKeywords(): Promise<string[]> {
  const res = await fetch("/api/news/keywords");
  if (!res.ok) throw new Error(`news/keywords: ${res.status}`);
  const data = await res.json();
  return data.keywords;
}

export async function saveNewsKeywords(keywords: string[]): Promise<string[]> {
  const res = await fetch("/api/news/keywords", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keywords }),
  });
  if (!res.ok) throw new Error(`news/keywords PUT: ${res.status}`);
  const data = await res.json();
  return data.keywords;
}
