import type { FeedItem } from '../types'

interface FeedSource {
  name: string
  interval: number
  fetch(): Promise<FeedItem[]>
}

// --- CryptoCompare News Source ---
const cryptoNewsSource: FeedSource = {
  name: 'CryptoCompare',
  interval: 60_000,
  async fetch(): Promise<FeedItem[]> {
    const raw: Array<{
      title: string
      url: string
      source: string
      body: string
      timestamp: number
      categories: string
    }> = await (window as unknown as { api: Record<string, Function> }).api.fetchCryptoNews()

    return raw.map((item, i) => {
      const cats = item.categories.toLowerCase()
      const isExchange = cats.includes('exchange')
      const isRegulation = cats.includes('regulation') || cats.includes('government')
      const isMining = cats.includes('mining') || cats.includes('blockchain')

      let category: FeedItem['category'] = 'crypto'
      if (isExchange) category = 'exchange'
      else if (isRegulation) category = 'macro'
      else if (isMining) category = 'onchain'

      return {
        id: `cn-${item.timestamp}-${i}`,
        title: item.title,
        source: item.source,
        url: item.url,
        category,
        importance: 'signal' as const,
        timestamp: item.timestamp,
        summary: item.body,
      }
    })
  },
}

// --- Fear & Greed Source ---
const fearGreedSource: FeedSource = {
  name: 'FearGreed',
  interval: 300_000,
  async fetch(): Promise<FeedItem[]> {
    const data: { value: number; classification: string; timestamp: number } | null =
      await (window as unknown as { api: Record<string, Function> }).api.fetchFearGreed()

    if (!data) return []

    const importance = data.value <= 25 || data.value >= 75 ? 'alert' as const : 'signal' as const

    return [{
      id: `fng-${data.timestamp}`,
      title: `Fear & Greed Index: ${data.value} (${data.classification})`,
      source: 'Alternative.me',
      url: 'https://alternative.me/crypto/fear-and-greed-index/',
      category: 'crypto' as const,
      importance,
      timestamp: data.timestamp,
    }]
  },
}

// --- Feed Service Manager ---
class FeedServiceManager {
  private sources: FeedSource[] = [cryptoNewsSource, fearGreedSource]
  private listeners = new Set<(items: FeedItem[]) => void>()
  private timers: ReturnType<typeof setInterval>[] = []
  private allItems = new Map<string, FeedItem>()

  startAll() {
    for (const source of this.sources) {
      const run = async () => {
        try {
          const items = await source.fetch()
          for (const item of items) {
            this.allItems.set(item.id, item)
          }
          this.notify()
        } catch (err) {
          console.error(`[feedService] ${source.name} failed:`, err)
        }
      }

      // 즉시 fetch + interval
      run()
      this.timers.push(setInterval(run, source.interval))
    }
  }

  stopAll() {
    for (const timer of this.timers) clearInterval(timer)
    this.timers = []
  }

  onUpdate(callback: (items: FeedItem[]) => void): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)
  }

  private notify() {
    const items = Array.from(this.allItems.values())
      .sort((a, b) => b.timestamp - a.timestamp)
    for (const listener of this.listeners) {
      listener(items)
    }
  }
}

export const feedService = new FeedServiceManager()
