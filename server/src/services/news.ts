import { config } from '../config.js'
import { getAllKeywords } from '../db/newsKeywordsRepository.js'

type FinnhubNewsItem = {
  headline: string
  source: string
  datetime: number // Unix seconds
  url: string
}

export interface NewsItem {
  title: string
  source: string
  publishedAt: string // "MM/DD/YYYY HH:mm ET"
  url: string
}

function formatET(unixSeconds: number): string {
  return (
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .format(new Date(unixSeconds * 1000))
      .replace(',', '') + ' ET'
  )
}

export async function fetchLatestNews(limit: number = 10): Promise<NewsItem[]> {
  const [keywords, res] = await Promise.all([
    getAllKeywords(),
    fetch(`https://finnhub.io/api/v1/news?category=general&token=${config.finnhubApiKey}`),
  ])

  if (!res.ok) throw new Error(`Finnhub responded with ${res.status}`)
  const data = (await res.json()) as FinnhubNewsItem[]

  const isRelevant = (headline: string) => {
    const lower = headline.toLowerCase()
    return keywords.some((kw) => lower.includes(kw))
  }

  return data
    .sort((a, b) => b.datetime - a.datetime)
    .filter((item) => isRelevant(item.headline))
    .slice(0, limit)
    .map((item) => ({
      title: item.headline,
      source: item.source,
      publishedAt: formatET(item.datetime),
      url: item.url,
    }))
}
