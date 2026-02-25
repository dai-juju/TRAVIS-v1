// 전통자산 가격 — Yahoo Finance v8 Chart API (무료, 키 불필요)

const SYMBOL_MAP: Record<string, string> = {
  SPX: '%5EGSPC',       // S&P 500 (^GSPC URL-encoded)
  NASDAQ: '%5EIXIC',    // NASDAQ Composite (^IXIC)
  DXY: 'DX-Y.NYB',     // US Dollar Index
  GOLD: 'GC%3DF',       // Gold Futures (GC=F)
  OIL: 'CL%3DF',        // Crude Oil Futures (CL=F)
}

export interface TradFiQuote {
  symbol: string
  price: number
  change: number // 24h % change
}

export type TradFiResult = Record<string, TradFiQuote | null>

async function fetchSingleQuote(
  internalSymbol: string,
  yahooSymbol: string
): Promise<TradFiQuote | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?range=1d&interval=1d`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    if (!res.ok) return null

    const data = await res.json()
    const meta = data?.chart?.result?.[0]?.meta
    if (!meta) return null

    const price = meta.regularMarketPrice
    const prevClose = meta.chartPreviousClose ?? meta.previousClose
    if (typeof price !== 'number') return null

    const change = prevClose ? ((price - prevClose) / prevClose) * 100 : 0

    return { symbol: internalSymbol, price, change }
  } catch {
    return null
  }
}

export async function fetchTraditionalAssets(): Promise<TradFiResult> {
  const entries = Object.entries(SYMBOL_MAP)
  const results = await Promise.allSettled(
    entries.map(([key, yahoo]) => fetchSingleQuote(key, yahoo))
  )

  const out: TradFiResult = {}
  results.forEach((r, i) => {
    const key = entries[i][0]
    out[key] = r.status === 'fulfilled' ? r.value : null
  })
  return out
}
