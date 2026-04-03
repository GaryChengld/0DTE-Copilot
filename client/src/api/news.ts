export interface NewsItem {
  title: string;
  source: string;
  publishedAt: string; // "MM/DD/YYYY HH:mm ET"
  url: string;
}

export interface NewsResponse {
  timestamp: string;
  news: NewsItem[];
}

export async function getNews(): Promise<NewsResponse> {
  const res = await fetch("/api/news");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
