export interface KlineData {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

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

export async function fetchKlines(
  symbol: string,
  interval: string = '1h',
  limit: number = 100
): Promise<KlineData[]> {
  try {
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=${interval}&limit=${limit}`
    const res = await fetch(url, { headers: { 'User-Agent': 'TRAVIS/1.0' } })
    if (!res.ok) throw new Error(`Binance klines ${res.status}`)

    const data = (await res.json()) as unknown[][]
    return data.map((k) => ({
      time: Math.floor(Number(k[0]) / 1000),
      open: parseFloat(String(k[1])),
      high: parseFloat(String(k[2])),
      low: parseFloat(String(k[3])),
      close: parseFloat(String(k[4])),
      volume: parseFloat(String(k[5])),
    }))
  } catch (err) {
    console.error('[binanceApi] klines fetch failed:', err)
    throw err
  }
}

export async function fetchRecentTrades(
  symbol: string,
  limit: number = 500
): Promise<TradeData[]> {
  try {
    const url = `https://api.binance.com/api/v3/trades?symbol=${symbol}USDT&limit=${limit}`
    const res = await fetch(url, { headers: { 'User-Agent': 'TRAVIS/1.0' } })
    if (!res.ok) throw new Error(`Binance trades ${res.status}`)

    const data = (await res.json()) as Array<Record<string, unknown>>
    return data.map((t) => ({
      id: Number(t.id),
      price: String(t.price),
      qty: String(t.qty),
      quoteQty: String(t.quoteQty),
      time: Number(t.time),
      isBuyerMaker: Boolean(t.isBuyerMaker),
    }))
  } catch (err) {
    console.error('[binanceApi] trades fetch failed:', err)
    throw err
  }
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
