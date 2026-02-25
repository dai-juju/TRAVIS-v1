export interface KimchiPremiumData {
  symbol: string
  upbitPriceKRW: number
  exchangeRate: number
  upbitPriceUSD: number
  premiumPercent: number
  binancePriceUSD: number
}

// Supported Upbit symbols
const UPBIT_SYMBOLS = ['BTC', 'ETH', 'XRP', 'SOL', 'DOGE', 'ADA']

// USD→KRW exchange rate cache (5min)
let cachedRate: { rate: number; time: number } | null = null
const RATE_CACHE_MS = 5 * 60 * 1000

async function getExchangeRate(): Promise<number> {
  if (cachedRate && Date.now() - cachedRate.time < RATE_CACHE_MS) {
    return cachedRate.rate
  }
  const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD')
  if (!res.ok) throw new Error(`Exchange rate API ${res.status}`)
  const data = await res.json()
  const rate = data.rates?.KRW
  if (!rate) throw new Error('KRW rate not found')
  cachedRate = { rate, time: Date.now() }
  return rate
}

export async function fetchKimchiPremium(
  symbols?: string[]
): Promise<Record<string, KimchiPremiumData>> {
  const targetSymbols = (symbols ?? UPBIT_SYMBOLS).filter((s) =>
    UPBIT_SYMBOLS.includes(s.toUpperCase())
  ).map((s) => s.toUpperCase())

  if (targetSymbols.length === 0) return {}

  // Parallel fetch: exchange rate + Upbit + Binance
  const upbitMarkets = targetSymbols.map((s) => `KRW-${s}`).join(',')
  const binanceSymbols = JSON.stringify(targetSymbols.map((s) => `${s}USDT`))

  const [rate, upbitRes, binanceRes] = await Promise.all([
    getExchangeRate(),
    fetch(`https://api.upbit.com/v1/ticker?markets=${upbitMarkets}`),
    fetch(`https://api.binance.com/api/v3/ticker/price?symbols=${encodeURIComponent(binanceSymbols)}`),
  ])

  if (!upbitRes.ok) throw new Error(`Upbit API ${upbitRes.status}`)
  if (!binanceRes.ok) throw new Error(`Binance API ${binanceRes.status}`)

  const upbitData: Array<{ market: string; trade_price: number }> = await upbitRes.json()
  const binanceData: Array<{ symbol: string; price: string }> = await binanceRes.json()

  // Build lookup maps
  const upbitMap = new Map<string, number>()
  for (const item of upbitData) {
    const sym = item.market.replace('KRW-', '')
    upbitMap.set(sym, item.trade_price)
  }

  const binanceMap = new Map<string, number>()
  for (const item of binanceData) {
    const sym = item.symbol.replace('USDT', '')
    binanceMap.set(sym, parseFloat(item.price))
  }

  const result: Record<string, KimchiPremiumData> = {}

  for (const sym of targetSymbols) {
    const upbitKRW = upbitMap.get(sym)
    const binanceUSD = binanceMap.get(sym)
    if (upbitKRW == null || binanceUSD == null || binanceUSD === 0) continue

    const upbitUSD = upbitKRW / rate
    const premium = ((upbitUSD - binanceUSD) / binanceUSD) * 100

    result[sym] = {
      symbol: sym,
      upbitPriceKRW: upbitKRW,
      exchangeRate: rate,
      upbitPriceUSD: upbitUSD,
      premiumPercent: premium,
      binancePriceUSD: binanceUSD,
    }
  }

  return result
}
