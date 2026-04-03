import { config } from "../config.js";

type FinnhubNewsItem = {
  headline: string;
  source: string;
  datetime: number; // Unix seconds
  url: string;
};

export interface NewsItem {
  title: string;
  source: string;
  publishedAt: string; // "MM/DD/YYYY HH:mm ET"
  url: string;
}

function formatET(unixSeconds: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(new Date(unixSeconds * 1000))
    .replace(",", "") + " ET";
}

const ECONOMIC_KEYWORDS = [
  "fed", "federal reserve", "fomc", "powell", "rate cut", "rate hike", "interest rate",
  "cpi", "inflation", "gdp", "jobs", "nonfarm", "nfp", "unemployment", "payroll",
  "treasury", "yield", "recession", "economic", "economy", "fiscal", "monetary",
  "debt ceiling", "tariff", "trade war", "stimulus", "quantitative",
];

function isEconomicNews(headline: string): boolean {
  const lower = headline.toLowerCase();
  return ECONOMIC_KEYWORDS.some((kw) => lower.includes(kw));
}

export async function fetchLatestNews(limit: number = 10): Promise<NewsItem[]> {
  const url = `https://finnhub.io/api/v1/news?category=general&token=${config.finnhubApiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Finnhub responded with ${res.status}`);
  const data = (await res.json()) as FinnhubNewsItem[];
  return data
    .sort((a, b) => b.datetime - a.datetime)
    .filter((item) => isEconomicNews(item.headline))
    .slice(0, limit)
    .map((item) => ({
      title: item.headline,
      source: item.source,
      publishedAt: formatET(item.datetime),
      url: item.url,
    }));
}
