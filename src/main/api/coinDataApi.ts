// ============================================================
// Coin Data API — AI fetch_coin_data 도구용 종합 코인 데이터
// Phase 3A-2: 심볼/이름으로 검색 → CoinGecko + Binance 병렬 조회
// 선물 데이터(펀딩비, OI) 선택적 포함
// ============================================================

import { resolveSymbol } from './symbolResolverApi'
import { fetchWithRetry } from './utils/fetchWithRetry'
import { fetchFundingRate, fetchOpenInterest } from '../binanceFuturesApi'

// AI 도구가 반환하는 코인 종합 데이터
export interface CoinDataResult {
  // 기본 정보
  id: string
  symbol: string
  name: string

  // 가격
  currentPrice: number
  priceChange24h: number
  priceChangePercent24h: number

  // 시장 데이터
  marketCap: number
  marketCapRank: number | null
  totalVolume24h: number

  // ATH/ATL
  ath: number
  athChangePercent: number
  athDate: string

  // 공급량
  circulatingSupply: number
  totalSupply: number | null
  maxSupply: number | null

  // 성과
  priceChange7d: number | null
  priceChange30d: number | null

  // 선물 데이터 (선택)
  futures?: {
    fundingRate: number
    openInterest: number
    markPrice: number
  } | null

  // 메타
  categories: string[]
  description: string
  lastUpdated: string
  dataSource: string
}

// CoinGecko /coins/{id} 응답에서 USD 값을 추출하는 헬퍼
function usd(obj: unknown): number {
  if (obj && typeof obj === 'object' && 'usd' in obj) {
    return Number((obj as Record<string, unknown>).usd) || 0
  }
  return 0
}

function usdStr(obj: unknown): string {
  if (obj && typeof obj === 'object' && 'usd' in obj) {
    return String((obj as Record<string, unknown>).usd ?? '')
  }
  return ''
}

/**
 * 특정 코인의 종합 데이터를 조회한다.
 * 1. resolveSymbol(query)로 CoinGecko ID 확보
 * 2. CoinGecko /coins/{id} + Binance ticker 병렬 조회
 * 3. includeFutures=true면 선물 데이터도 병렬 조회
 * 4. 전체 실패 시 null 반환
 */
export async function fetchCoinData(
  query: string,
  includeFutures: boolean = false
): Promise<CoinDataResult | null> {
  try {
    // 1. 심볼 resolve
    const resolved = await resolveSymbol(query)
    if (!resolved) {
      console.warn('[coinDataApi] Could not resolve:', query)
      return null
    }

    console.log(`[coinDataApi] Fetching data for ${resolved.id} (${resolved.symbol})`)
    const binanceSymbol = resolved.symbol.toUpperCase()

    // 2. CoinGecko + Binance 병렬 조회 (응답 시간 최적화)
    const [cgResult, binanceResult] = await Promise.allSettled([
      // CoinGecko: 종합 코인 데이터
      fetchWithRetry(
        `https://api.coingecko.com/api/v3/coins/${resolved.id}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`,
        { headers: { 'User-Agent': 'TRAVIS/1.0' } }
      ).then(async (res) => {
        if (!res.ok) throw new Error(`CoinGecko ${res.status}`)
        return res.json()
      }),

      // Binance: 실시간 24hr 시세 (CoinGecko보다 더 실시간)
      fetch(
        `https://api.binance.com/api/v3/ticker/24hr?symbol=${binanceSymbol}USDT`,
        { headers: { 'User-Agent': 'TRAVIS/1.0' } }
      ).then(async (res) => {
        if (!res.ok) return null // Binance에 없는 코인일 수 있음
        return res.json()
      }),
    ])

    // CoinGecko 데이터는 필수
    if (cgResult.status === 'rejected') {
      console.error('[coinDataApi] CoinGecko fetch failed:', cgResult.reason)
      return null
    }

    const cgData = cgResult.value as Record<string, unknown>
    const md = cgData.market_data as Record<string, unknown> | undefined
    if (!md) {
      console.error('[coinDataApi] No market_data in CoinGecko response')
      return null
    }

    // Binance 데이터 (선택적 — 있으면 더 정확한 실시간 가격 사용)
    const binanceData = binanceResult.status === 'fulfilled' ? binanceResult.value : null
    const dataSources: string[] = ['coingecko']

    // 가격 결정: Binance 가격 우선, 없으면 CoinGecko 가격
    let currentPrice = usd(md.current_price)
    let priceChange24h = Number(md.price_change_24h) || 0
    let priceChangePercent24h = Number(md.price_change_percentage_24h) || 0

    if (binanceData) {
      dataSources.push('binance')
      currentPrice = parseFloat(binanceData.lastPrice) || currentPrice
      priceChangePercent24h = parseFloat(binanceData.priceChangePercent) || priceChangePercent24h
      priceChange24h = parseFloat(binanceData.priceChange) || priceChange24h
    }

    // 설명 추출 (영문, 500자까지)
    const rawDesc = cgData.description as Record<string, string> | undefined
    const description = rawDesc?.en
      ? rawDesc.en.replace(/<[^>]*>/g, '').slice(0, 500)
      : ''

    // 카테고리 추출
    const categories = Array.isArray(cgData.categories)
      ? (cgData.categories as string[]).filter(Boolean)
      : []

    // 3. 선물 데이터 조회 (선택적, 독립적 실패)
    let futures: CoinDataResult['futures'] = null
    if (includeFutures) {
      const [fundingResult, oiResult] = await Promise.allSettled([
        fetchFundingRate(binanceSymbol),
        fetchOpenInterest(binanceSymbol),
      ])

      if (fundingResult.status === 'fulfilled' && oiResult.status === 'fulfilled') {
        futures = {
          fundingRate: fundingResult.value.lastFundingRate,
          markPrice: fundingResult.value.markPrice,
          openInterest: oiResult.value.openInterest,
        }
        dataSources.push('binance-futures')
      } else if (fundingResult.status === 'fulfilled') {
        futures = {
          fundingRate: fundingResult.value.lastFundingRate,
          markPrice: fundingResult.value.markPrice,
          openInterest: 0,
        }
        dataSources.push('binance-futures')
      }
    }

    // 4. 종합 데이터 객체 구성
    return {
      id: resolved.id,
      symbol: resolved.symbol,
      name: String(cgData.name ?? resolved.name),

      currentPrice,
      priceChange24h,
      priceChangePercent24h,

      marketCap: usd(md.market_cap),
      marketCapRank: Number(md.market_cap_rank) || resolved.marketCapRank,
      totalVolume24h: usd(md.total_volume),

      ath: usd(md.ath),
      athChangePercent: usd(md.ath_change_percentage),
      athDate: usdStr(md.ath_date),

      circulatingSupply: Number(md.circulating_supply) || 0,
      totalSupply: md.total_supply != null ? Number(md.total_supply) : null,
      maxSupply: md.max_supply != null ? Number(md.max_supply) : null,

      priceChange7d: Number(md.price_change_percentage_7d) || null,
      priceChange30d: Number(md.price_change_percentage_30d) || null,

      futures,

      categories,
      description,
      lastUpdated: new Date().toISOString(),
      dataSource: dataSources.join('+'),
    }
  } catch (err) {
    console.error('[coinDataApi] fetchCoinData failed:', err)
    return null
  }
}
