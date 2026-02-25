export interface CryptoNewsItem {
  title: string
  url: string
  source: string
  body: string
  timestamp: number
  categories: string
}

export interface FearGreedData {
  value: number
  classification: string
  timestamp: number
}

export async function fetchCryptoNews(): Promise<CryptoNewsItem[]> {
  try {
    const res = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN&limit=30', {
      headers: { 'User-Agent': 'TRAVIS/1.0' },
    })

    if (!res.ok) throw new Error(`CryptoCompare ${res.status}`)

    const data = await res.json()
    const articles = (data?.Data ?? []) as Array<Record<string, unknown>>

    return articles.map((item) => ({
      title: String(item.title ?? ''),
      url: String(item.url ?? ''),
      source: String(item.source ?? 'CryptoCompare'),
      body: String(item.body ?? '').slice(0, 200),
      timestamp: Number(item.published_on ?? 0) * 1000,
      categories: String(item.categories ?? ''),
    }))
  } catch (err) {
    console.error('[feedApi] CryptoCompare news fetch failed:', err)
    return []
  }
}

export async function fetchFearGreed(): Promise<FearGreedData | null> {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1')

    if (!res.ok) throw new Error(`FearGreed ${res.status}`)

    const data = await res.json()
    const entry = data?.data?.[0]
    if (!entry) return null

    return {
      value: Number(entry.value),
      classification: String(entry.value_classification),
      timestamp: Number(entry.timestamp) * 1000,
    }
  } catch (err) {
    console.error('[feedApi] Fear & Greed fetch failed:', err)
    return null
  }
}
