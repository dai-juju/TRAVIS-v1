// ============================================================
// Market Overview API — AI fetch_market_overview 도구용
// Phase 3A-3: 전체 크립토 시장 상황 종합 (글로벌 메트릭 + 공포탐욕 + Top 상승/하락)
// 3개 API를 Promise.allSettled로 병렬 호출, 독립적 실패
// ============================================================

import { fetchWithRetry } from './utils/fetchWithRetry'

export interface MarketOverview {
  // 글로벌 메트릭
  totalMarketCap: number
  totalVolume24h: number
  btcDominance: number
  ethDominance: number
  activeCryptocurrencies: number
  marketCapChangePercent24h: number

  // 공포탐욕 지수
  fearGreedIndex: {
    value: number           // 0-100
    classification: string  // "Extreme Fear", "Fear", "Neutral", "Greed", "Extreme Greed"
  } | null

  // 상승/하락 Top 5
  topGainers: Array<{
    symbol: string
    name: string
    priceChangePercent24h: number
    currentPrice: number
  }>
  topLosers: Array<{
    symbol: string
    name: string
    priceChangePercent24h: number
    currentPrice: number
  }>

  lastUpdated: string
}

// 스테이블코인 심볼 — 상승/하락 Top에서 제외
const STABLECOINS = new Set([
  'usdt', 'usdc', 'busd', 'dai', 'tusd', 'usdp', 'gusd',
  'frax', 'lusd', 'usdd', 'fdusd', 'pyusd', 'eurc',
])

/**
 * 전체 크립토 시장 상황을 종합 조회한다.
 * 1. CoinGecko /global → 총 시총, BTC 도미넌스, 거래량
 * 2. Alternative.me Fear & Greed Index → 시장 심리
 * 3. CoinGecko /coins/markets → Top 상승/하락 코인
 * 각 API 독립적 실패 — 하나가 죽어도 나머지는 반환
 */
export async function fetchMarketOverview(): Promise<MarketOverview | null> {
  try {
    const [globalResult, fngResult, marketsResult] = await Promise.allSettled([
      // 1. CoinGecko /global — 글로벌 시장 메트릭
      fetchWithRetry('https://api.coingecko.com/api/v3/global', {
        headers: { 'User-Agent': 'TRAVIS/1.0' },
      }).then(async (res) => {
        if (!res.ok) throw new Error(`CoinGecko global ${res.status}`)
        return res.json()
      }),

      // 2. Alternative.me Fear & Greed Index
      fetchWithRetry('https://api.alternative.me/fng/?limit=1').then(async (res) => {
        if (!res.ok) throw new Error(`FNG ${res.status}`)
        return res.json()
      }),

      // 3. CoinGecko /coins/markets — 상위 250개 코인 (24h 변동률 포함)
      fetchWithRetry(
        'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=1&sparkline=false&price_change_percentage=24h',
        { headers: { 'User-Agent': 'TRAVIS/1.0' } }
      ).then(async (res) => {
        if (!res.ok) throw new Error(`CoinGecko markets ${res.status}`)
        return res.json()
      }),
    ])

    // 글로벌 데이터 파싱 (필수 — 실패하면 전체 null)
    if (globalResult.status === 'rejected') {
      console.error('[marketOverview] CoinGecko global failed:', globalResult.reason)
      return null
    }

    const globalData = (globalResult.value as Record<string, unknown>).data as Record<string, unknown>
    if (!globalData) {
      console.error('[marketOverview] No data in global response')
      return null
    }

    const totalMcap = globalData.total_market_cap as Record<string, number> | undefined
    const totalVol = globalData.total_volume as Record<string, number> | undefined
    const mcapPct = globalData.market_cap_change_percentage_24h_usd as number | undefined
    const mcapPercentage = globalData.market_cap_percentage as Record<string, number> | undefined

    // Fear & Greed 파싱 (선택적)
    let fearGreedIndex: MarketOverview['fearGreedIndex'] = null
    if (fngResult.status === 'fulfilled') {
      const fngData = fngResult.value as { data?: Array<{ value: string; value_classification: string }> }
      if (fngData.data && fngData.data.length > 0) {
        fearGreedIndex = {
          value: parseInt(fngData.data[0].value, 10),
          classification: fngData.data[0].value_classification,
        }
      }
    } else {
      console.warn('[marketOverview] Fear & Greed fetch failed:', fngResult.reason)
    }

    // Top Gainers / Losers 파싱 (선택적)
    let topGainers: MarketOverview['topGainers'] = []
    let topLosers: MarketOverview['topLosers'] = []
    if (marketsResult.status === 'fulfilled') {
      const coins = marketsResult.value as Array<{
        symbol: string
        name: string
        current_price: number | null
        price_change_percentage_24h: number | null
      }>

      // 스테이블코인 제외, 가격과 변동률이 있는 코인만
      const valid = coins.filter(
        (c) =>
          !STABLECOINS.has(c.symbol.toLowerCase()) &&
          c.current_price != null &&
          c.price_change_percentage_24h != null
      )

      // 변동률 기준 정렬
      const sorted = [...valid].sort(
        (a, b) => (b.price_change_percentage_24h ?? 0) - (a.price_change_percentage_24h ?? 0)
      )

      topGainers = sorted.slice(0, 5).map((c) => ({
        symbol: c.symbol.toUpperCase(),
        name: c.name,
        priceChangePercent24h: c.price_change_percentage_24h ?? 0,
        currentPrice: c.current_price ?? 0,
      }))

      topLosers = sorted
        .slice(-5)
        .reverse()
        .map((c) => ({
          symbol: c.symbol.toUpperCase(),
          name: c.name,
          priceChangePercent24h: c.price_change_percentage_24h ?? 0,
          currentPrice: c.current_price ?? 0,
        }))
    } else {
      console.warn('[marketOverview] CoinGecko markets failed:', marketsResult.reason)
    }

    return {
      totalMarketCap: totalMcap?.usd ?? 0,
      totalVolume24h: totalVol?.usd ?? 0,
      btcDominance: mcapPercentage?.btc ?? 0,
      ethDominance: mcapPercentage?.eth ?? 0,
      activeCryptocurrencies: Number(globalData.active_cryptocurrencies) || 0,
      marketCapChangePercent24h: mcapPct ?? 0,

      fearGreedIndex,
      topGainers,
      topLosers,

      lastUpdated: new Date().toISOString(),
    }
  } catch (err) {
    console.error('[marketOverview] fetchMarketOverview failed:', err)
    return null
  }
}
