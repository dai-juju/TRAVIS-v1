export interface TradeData {
  id: number
  price: string
  qty: string
  quoteQty: string
  time: number
  isBuyerMaker: boolean
}

export interface TickerSummary {
  price: string
  change: string
  volume: string
}

export async function fetchRecentTrades(
  symbol: string,
  limit: number = 500
): Promise<{ trades: TradeData[]; pair: string }> {
  const quotes = ['USDT', 'BTC', 'FDUSD']

  for (const quote of quotes) {
    try {
      const pair = `${symbol}${quote}`
      const url = `https://api.binance.com/api/v3/trades?symbol=${pair}&limit=${limit}`
      const res = await fetch(url, { headers: { 'User-Agent': 'TRAVIS/1.0' } })
      if (!res.ok) continue

      const data = (await res.json()) as Array<Record<string, unknown>>
      const trades = data.map((t) => ({
        id: Number(t.id),
        price: String(t.price),
        qty: String(t.qty),
        quoteQty: String(t.quoteQty),
        time: Number(t.time),
        isBuyerMaker: Boolean(t.isBuyerMaker),
      }))
      return { trades, pair }
    } catch {
      continue
    }
  }

  throw new Error(`No trade data for ${symbol} on any pair`)
}

export async function fetchMultipleTickers(
  symbols: string[]
): Promise<Record<string, TickerSummary>> {
  const results: Record<string, TickerSummary> = {}

  const promises = symbols.map(async (sym) => {
    try {
      const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${sym}USDT`
      const res = await fetch(url, { headers: { 'User-Agent': 'TRAVIS/1.0' } })
      if (!res.ok) return { sym, data: null }

      const data = (await res.json()) as Record<string, unknown>
      return {
        sym,
        data: {
          price: String(data.lastPrice ?? '0'),
          change: String(data.priceChangePercent ?? '0'),
          volume: String(data.quoteVolume ?? '0'),
        },
      }
    } catch {
      return { sym, data: null }
    }
  })

  const settled = await Promise.allSettled(promises)
  for (const result of settled) {
    if (result.status === 'fulfilled' && result.value.data) {
      results[result.value.sym] = result.value.data
    }
  }

  return results
}
