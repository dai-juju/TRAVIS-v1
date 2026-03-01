// ============================================================
// Trending API — AI fetch_trending 도구용
// Phase 3A-6: CoinGecko /search/trending으로 트렌딩 코인/NFT/카테고리 조회
// 단일 API 호출, 소방 호스 철학 — 모든 데이터를 가져오고 AI가 선별
// ============================================================

import { fetchWithRetry } from './utils/fetchWithRetry'

export interface TrendingData {
  trendingCoins: Array<{
    id: string
    symbol: string
    name: string
    marketCapRank: number | null
    thumb: string
    priceChangePercent24h: number | null
    priceBtc: number
    marketCap: number | null
    totalVolume: number | null
  }>

  // 트렌딩 NFT (CoinGecko가 제공하면 포함)
  trendingNfts: Array<{
    id: string
    name: string
    symbol: string
    thumb: string
  }> | null

  // 트렌딩 카테고리 (CoinGecko가 제공하면 포함)
  trendingCategories: Array<{
    id: number
    name: string
    marketCapChange24h: number
  }> | null

  dataSource: string
  lastUpdated: string
}

/**
 * CoinGecko 트렌딩 데이터를 조회한다.
 * 검색량 급증 코인, NFT, 카테고리를 모두 반환.
 */
export async function fetchTrending(): Promise<TrendingData | null> {
  try {
    const res = await fetchWithRetry('https://api.coingecko.com/api/v3/search/trending', {
      headers: { 'User-Agent': 'TRAVIS/1.0' },
    })

    if (!res.ok) {
      console.error(`[trendingApi] CoinGecko trending ${res.status}`)
      return null
    }

    const data = await res.json() as Record<string, unknown>

    // 트렌딩 코인 파싱
    const coinsRaw = data.coins as Array<{ item: Record<string, unknown> }> | undefined
    const trendingCoins = (coinsRaw || []).map((entry) => {
      const item = entry.item || {}
      const priceData = item.data as Record<string, unknown> | undefined
      return {
        id: String(item.id || ''),
        symbol: String(item.symbol || ''),
        name: String(item.name || ''),
        marketCapRank: item.market_cap_rank != null ? Number(item.market_cap_rank) : null,
        thumb: String(item.thumb || item.small || ''),
        priceChangePercent24h: priceData?.price_change_percentage_24h != null
          ? Number((priceData.price_change_percentage_24h as Record<string, number>)?.usd ?? priceData.price_change_percentage_24h)
          : null,
        priceBtc: Number(item.price_btc) || 0,
        marketCap: priceData?.market_cap != null ? Number(String(priceData.market_cap).replace(/[,$]/g, '')) : null,
        totalVolume: priceData?.total_volume != null ? Number(String(priceData.total_volume).replace(/[,$]/g, '')) : null,
      }
    })

    // 트렌딩 NFT 파싱
    let trendingNfts: TrendingData['trendingNfts'] = null
    const nftsRaw = data.nfts as Array<Record<string, unknown>> | undefined
    if (nftsRaw && Array.isArray(nftsRaw) && nftsRaw.length > 0) {
      trendingNfts = nftsRaw.map((nft) => ({
        id: String(nft.id || ''),
        name: String(nft.name || ''),
        symbol: String(nft.symbol || ''),
        thumb: String(nft.thumb || ''),
      }))
    }

    // 트렌딩 카테고리 파싱
    let trendingCategories: TrendingData['trendingCategories'] = null
    const catsRaw = data.categories as Array<Record<string, unknown>> | undefined
    if (catsRaw && Array.isArray(catsRaw) && catsRaw.length > 0) {
      trendingCategories = catsRaw.map((cat) => ({
        id: Number(cat.id) || 0,
        name: String(cat.name || ''),
        marketCapChange24h: Number(cat.market_cap_1h_change) || Number(cat.market_cap_change_24h) || 0,
      }))
    }

    return {
      trendingCoins,
      trendingNfts,
      trendingCategories,
      dataSource: 'coingecko',
      lastUpdated: new Date().toISOString(),
    }
  } catch (err) {
    console.error('[trendingApi] fetchTrending failed:', err)
    return null
  }
}
