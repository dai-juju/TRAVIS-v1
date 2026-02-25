export interface FundingRateData {
  symbol: string
  markPrice: number
  lastFundingRate: number   // 0.0001 = 0.01%
  nextFundingTime: number   // Unix ms
}

export interface OpenInterestData {
  symbol: string
  openInterest: number      // base asset qty
}

export async function fetchFundingRate(symbol: string): Promise<FundingRateData> {
  const pair = symbol.toUpperCase().replace(/(USDT|BUSD|FDUSD|USD)$/i, '') + 'USDT'
  const res = await fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${pair}`)
  if (!res.ok) throw new Error(`Binance Futures funding ${res.status}`)
  const d = await res.json()
  return {
    symbol: d.symbol,
    markPrice: parseFloat(d.markPrice),
    lastFundingRate: parseFloat(d.lastFundingRate),
    nextFundingTime: d.nextFundingTime,
  }
}

export async function fetchOpenInterest(symbol: string): Promise<OpenInterestData> {
  const pair = symbol.toUpperCase().replace(/(USDT|BUSD|FDUSD|USD)$/i, '') + 'USDT'
  const res = await fetch(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${pair}`)
  if (!res.ok) throw new Error(`Binance Futures OI ${res.status}`)
  const d = await res.json()
  return {
    symbol: d.symbol,
    openInterest: parseFloat(d.openInterest),
  }
}
