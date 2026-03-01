// ============================================================
// CoinMarketCap API — 보조 시장 데이터 소스
// Phase 3A-5: CMC Pro API를 통한 코인 데이터, 글로벌 메트릭,
// 카테고리, 신규 상장 조회
// API 키가 있을 때만 동작, 없으면 기존 CoinGecko 데이터만 사용
// ============================================================

import { fetchWithRetry } from './utils/fetchWithRetry'

const CMC_BASE_URL = 'https://pro-api.coinmarketcap.com'

// CMC API 호출 헬퍼 (API 키를 헤더에 포함)
async function cmcFetch(endpoint: string, apiKey: string, params?: Record<string, string>) {
  const url = new URL(`${CMC_BASE_URL}${endpoint}`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }

  const response = await fetchWithRetry(url.toString(), {
    headers: {
      'X-CMC_PRO_API_KEY': apiKey,
      'Accept': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`CMC API error: ${response.status}`)
  }

  const data = await response.json()
  return data
}

// === 코인 상세 데이터 ===
export async function cmcGetCoinData(apiKey: string, symbol: string): Promise<{
  id: number
  name: string
  symbol: string
  rank: number
  price: number
  marketCap: number
  volume24h: number
  percentChange1h: number
  percentChange24h: number
  percentChange7d: number
  percentChange30d: number
  circulatingSupply: number
  totalSupply: number | null
  maxSupply: number | null
  tags: string[]
  dateAdded: string
  platform: { name: string; symbol: string } | null
  dataSource: string
} | null> {
  try {
    const data = await cmcFetch('/v2/cryptocurrency/quotes/latest', apiKey, {
      symbol: symbol.toUpperCase(),
      convert: 'USD',
    })

    // CMC는 같은 심볼에 여러 코인이 있을 수 있음. 첫 번째(시총 기준)를 사용
    const coins = data?.data?.[symbol.toUpperCase()]
    if (!coins || coins.length === 0) return null

    const coin = coins[0]
    const quote = coin.quote?.USD

    return {
      id: coin.id,
      name: coin.name,
      symbol: coin.symbol,
      rank: coin.cmc_rank,
      price: quote?.price,
      marketCap: quote?.market_cap,
      volume24h: quote?.volume_24h,
      percentChange1h: quote?.percent_change_1h,
      percentChange24h: quote?.percent_change_24h,
      percentChange7d: quote?.percent_change_7d,
      percentChange30d: quote?.percent_change_30d,
      circulatingSupply: coin.circulating_supply,
      totalSupply: coin.total_supply,
      maxSupply: coin.max_supply,
      tags: coin.tags?.map((t: { name?: string }) => t.name || t) || [],
      dateAdded: coin.date_added,
      platform: coin.platform ? { name: coin.platform.name, symbol: coin.platform.symbol } : null,
      dataSource: 'coinmarketcap',
    }
  } catch (error) {
    console.error('[cmcApi] cmcGetCoinData failed:', error)
    return null
  }
}

// === 글로벌 메트릭 ===
export async function cmcGetGlobalMetrics(apiKey: string): Promise<{
  totalMarketCap: number
  totalVolume24h: number
  btcDominance: number
  ethDominance: number
  activeCryptocurrencies: number
  totalExchanges: number
  defiVolume24h: number
  defiMarketCap: number
  stablecoinVolume24h: number
  stablecoinMarketCap: number
  dataSource: string
} | null> {
  try {
    const data = await cmcFetch('/v1/global-metrics/quotes/latest', apiKey, {
      convert: 'USD',
    })

    const d = data?.data
    if (!d) return null

    return {
      totalMarketCap: d.quote?.USD?.total_market_cap,
      totalVolume24h: d.quote?.USD?.total_volume_24h,
      btcDominance: d.btc_dominance,
      ethDominance: d.eth_dominance,
      activeCryptocurrencies: d.active_cryptocurrencies,
      totalExchanges: d.active_exchanges,
      defiVolume24h: d.defi_volume_24h,
      defiMarketCap: d.defi_market_cap,
      stablecoinVolume24h: d.stablecoin_volume_24h,
      stablecoinMarketCap: d.stablecoin_market_cap,
      dataSource: 'coinmarketcap',
    }
  } catch (error) {
    console.error('[cmcApi] cmcGetGlobalMetrics failed:', error)
    return null
  }
}

// === 카테고리별 코인 ===
export async function cmcGetCategories(apiKey: string): Promise<Array<{
  id: string
  name: string
  title: string
  numTokens: number
  marketCap: number
  marketCapChange24h: number
  volume24h: number
  volumeChange24h: number
}> | null> {
  try {
    const data = await cmcFetch('/v1/cryptocurrency/categories', apiKey, {
      limit: '20',
    })

    return data?.data?.map((cat: {
      id: string
      name: string
      title: string
      num_tokens: number
      market_cap: number
      market_cap_change: number
      volume: number
      volume_change: number
    }) => ({
      id: cat.id,
      name: cat.name,
      title: cat.title,
      numTokens: cat.num_tokens,
      marketCap: cat.market_cap,
      marketCapChange24h: cat.market_cap_change,
      volume24h: cat.volume,
      volumeChange24h: cat.volume_change,
    })) || null
  } catch (error) {
    console.error('[cmcApi] cmcGetCategories failed:', error)
    return null
  }
}

// === 최근 신규 상장 코인 ===
export async function cmcGetLatestListings(apiKey: string): Promise<Array<{
  name: string
  symbol: string
  rank: number
  dateAdded: string
  price: number
  marketCap: number
  volume24h: number
  percentChange24h: number
}> | null> {
  try {
    const data = await cmcFetch('/v1/cryptocurrency/listings/latest', apiKey, {
      sort: 'date_added',
      sort_dir: 'desc',
      limit: '20',
      convert: 'USD',
    })

    return data?.data?.map((coin: {
      name: string
      symbol: string
      cmc_rank: number
      date_added: string
      quote?: { USD?: { price: number; market_cap: number; volume_24h: number; percent_change_24h: number } }
    }) => ({
      name: coin.name,
      symbol: coin.symbol,
      rank: coin.cmc_rank,
      dateAdded: coin.date_added,
      price: coin.quote?.USD?.price,
      marketCap: coin.quote?.USD?.market_cap,
      volume24h: coin.quote?.USD?.volume_24h,
      percentChange24h: coin.quote?.USD?.percent_change_24h,
    })) || null
  } catch (error) {
    console.error('[cmcApi] cmcGetLatestListings failed:', error)
    return null
  }
}
