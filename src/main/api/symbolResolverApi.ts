// ============================================================
// Symbol Resolver API — CoinGecko /search로 아무 코인이든 동적 해석
// Phase 3A-1: KNOWN_SYMBOLS 하드코딩을 제거하고,
// "BTC", "bitcoin", "vana", "TRIA" 등 어떤 입력이든 자동으로 resolve
// ============================================================

import { fetchWithRetry } from './utils/fetchWithRetry'

export interface ResolvedCoin {
  id: string            // CoinGecko ID (예: "bitcoin", "vana-2")
  symbol: string        // 티커 (예: "btc", "vana")
  name: string          // 풀네임 (예: "Bitcoin", "Nirvana Chain")
  thumb: string         // 썸네일 URL
  marketCapRank: number | null
}

// 캐시: 한번 찾은 심볼은 다시 API 호출하지 않음
const resolvedCache = new Map<string, ResolvedCoin | null>()

// 주요 코인 빠른 매핑 — API 호출 없이 즉시 반환
const QUICK_RESOLVE: Record<string, ResolvedCoin> = {
  BTC:   { id: 'bitcoin',        symbol: 'btc',   name: 'Bitcoin',     thumb: '', marketCapRank: 1 },
  ETH:   { id: 'ethereum',       symbol: 'eth',   name: 'Ethereum',    thumb: '', marketCapRank: 2 },
  XRP:   { id: 'ripple',         symbol: 'xrp',   name: 'XRP',         thumb: '', marketCapRank: 3 },
  BNB:   { id: 'binancecoin',    symbol: 'bnb',   name: 'BNB',         thumb: '', marketCapRank: 4 },
  SOL:   { id: 'solana',         symbol: 'sol',   name: 'Solana',      thumb: '', marketCapRank: 5 },
  DOGE:  { id: 'dogecoin',       symbol: 'doge',  name: 'Dogecoin',    thumb: '', marketCapRank: 8 },
  ADA:   { id: 'cardano',        symbol: 'ada',   name: 'Cardano',     thumb: '', marketCapRank: 9 },
  AVAX:  { id: 'avalanche-2',    symbol: 'avax',  name: 'Avalanche',   thumb: '', marketCapRank: 12 },
  DOT:   { id: 'polkadot',       symbol: 'dot',   name: 'Polkadot',    thumb: '', marketCapRank: 13 },
  LINK:  { id: 'chainlink',      symbol: 'link',  name: 'Chainlink',   thumb: '', marketCapRank: 14 },
  MATIC: { id: 'matic-network',  symbol: 'matic', name: 'Polygon',     thumb: '', marketCapRank: 15 },
  SHIB:  { id: 'shiba-inu',      symbol: 'shib',  name: 'Shiba Inu',   thumb: '', marketCapRank: 16 },
  LTC:   { id: 'litecoin',       symbol: 'ltc',   name: 'Litecoin',    thumb: '', marketCapRank: 18 },
  UNI:   { id: 'uniswap',        symbol: 'uni',   name: 'Uniswap',     thumb: '', marketCapRank: 20 },
  PEPE:  { id: 'pepe',           symbol: 'pepe',  name: 'Pepe',        thumb: '', marketCapRank: 25 },
  ARB:   { id: 'arbitrum',       symbol: 'arb',   name: 'Arbitrum',    thumb: '', marketCapRank: 30 },
  OP:    { id: 'optimism',       symbol: 'op',    name: 'Optimism',    thumb: '', marketCapRank: 35 },
}

/**
 * CoinGecko /search API로 코인을 찾는다.
 * 1. QUICK_RESOLVE에서 즉시 반환 (주요 코인)
 * 2. 캐시 확인 (이전 검색 결과)
 * 3. CoinGecko /search API 호출
 * 4. 정확한 심볼 매치 우선, 그 다음 이름 매치, 시총 순 정렬
 * 에러 시 null 반환, 절대 throw하지 않음
 */
export async function resolveSymbol(query: string): Promise<ResolvedCoin | null> {
  const key = query.trim().toUpperCase()
  if (!key) return null

  // 1. 빠른 매핑 확인
  if (QUICK_RESOLVE[key]) return QUICK_RESOLVE[key]

  // 2. 캐시 확인 (대소문자 무시)
  if (resolvedCache.has(key)) return resolvedCache.get(key) ?? null

  try {
    // 3. CoinGecko /search API 호출
    console.log('[symbolResolver] Searching CoinGecko for:', key)
    const url = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query.trim())}`
    const res = await fetchWithRetry(url, { headers: { 'User-Agent': 'TRAVIS/1.0' } })

    if (!res.ok) {
      console.warn('[symbolResolver] CoinGecko search failed:', res.status)
      resolvedCache.set(key, null)
      return null
    }

    const data = (await res.json()) as {
      coins?: Array<{
        id: string
        symbol: string
        name: string
        thumb?: string
        large?: string
        market_cap_rank: number | null
      }>
    }
    const coins = data.coins ?? []

    // 4. 가장 적합한 매치 선택
    // 정확한 심볼 매치 우선 (시총 순위 정렬)
    const symbolMatches = coins
      .filter((c) => c.symbol.toUpperCase() === key)
      .sort((a, b) => (a.market_cap_rank ?? 9999) - (b.market_cap_rank ?? 9999))

    // 이름 매치 (대소문자 무시)
    const nameMatches = coins
      .filter((c) => c.name.toUpperCase() === key)
      .sort((a, b) => (a.market_cap_rank ?? 9999) - (b.market_cap_rank ?? 9999))

    const best = symbolMatches[0] || nameMatches[0] || null

    if (!best) {
      resolvedCache.set(key, null)
      return null
    }

    const resolved: ResolvedCoin = {
      id: best.id,
      symbol: best.symbol,
      name: best.name,
      thumb: best.thumb || best.large || '',
      marketCapRank: best.market_cap_rank ?? null,
    }

    console.log('[symbolResolver] Resolved:', key, '→', resolved.id, `(${resolved.name})`)
    resolvedCache.set(key, resolved)
    return resolved
  } catch (err) {
    console.error('[symbolResolver] Search error:', err)
    resolvedCache.set(key, null)
    return null
  }
}

/**
 * 여러 심볼을 한번에 resolve (Promise.allSettled 패턴)
 * 하나 실패해도 나머지는 정상 반환
 */
export async function resolveMultipleSymbols(queries: string[]): Promise<Map<string, ResolvedCoin>> {
  const results = new Map<string, ResolvedCoin>()
  await Promise.allSettled(
    queries.map(async (q) => {
      const resolved = await resolveSymbol(q)
      if (resolved) results.set(q.trim().toUpperCase(), resolved)
    })
  )
  return results
}
