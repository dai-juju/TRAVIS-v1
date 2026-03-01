// ============================================================
// CoinGecko API 모듈
// 역할: CoinGecko(코인게코)에서 암호화폐의 상세 정보를 가져옴
// CoinGecko = 전 세계 암호화폐 데이터를 모아놓은 무료 정보 사이트
// 제공 데이터: 시가총액, 거래량, 공급량, 역대 최고/최저가, 가격 변동률 등
// 사용처: 조사 모드에서 코인의 기본 정보(Fundamentals) 분석 시 사용
// ============================================================

// 코인 상세 데이터의 구조 정의
export interface CoinData {
  name: string              // 코인 이름 (예: "Bitcoin")
  symbol: string            // 코인 심볼 (예: "btc")
  marketCap: number         // 시가총액 (USD) — 전체 코인 가치
  volume24h: number         // 24시간 거래량 (USD)
  circulatingSupply: number // 유통 공급량 (현재 시장에 풀린 코인 수)
  totalSupply: number | null  // 총 공급량 (발행된 전체 코인 수, 없을 수 있음)
  maxSupply: number | null    // 최대 공급량 (발행 한도, 예: BTC는 2100만개)
  ath: number               // ATH = All Time High (역대 최고가)
  athDate: string           // ATH 달성 날짜
  atl: number               // ATL = All Time Low (역대 최저가)
  atlDate: string           // ATL 달성 날짜
  priceChange24h: number    // 24시간 가격 변동률 (%)
  priceChange7d: number     // 7일 가격 변동률 (%)
  priceChange30d: number    // 30일 가격 변동률 (%)
  categories?: string[]     // 카테고리 (예: "DeFi", "Layer 1" 등)
}

// CoinGecko 검색 결과 캐시 — 같은 코인을 반복 검색하지 않도록 결과를 저장
const resolvedCache = new Map<string, string | null>()

// 주요 코인의 심볼 → CoinGecko ID 매핑 테이블
// CoinGecko는 "BTC" 대신 "bitcoin"이라는 고유 ID를 사용하므로 변환이 필요
// 자주 사용하는 코인은 여기에 미리 등록해서 API 호출 없이 바로 변환
const SYMBOL_TO_COINGECKO: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  BNB: 'binancecoin',
  XRP: 'ripple',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  DOT: 'polkadot',
  AVAX: 'avalanche-2',
  MATIC: 'matic-network',
  LINK: 'chainlink',
  UNI: 'uniswap',
  LTC: 'litecoin',
  BCH: 'bitcoin-cash',
  SHIB: 'shiba-inu',
  PEPE: 'pepe',
  ARB: 'arbitrum',
  OP: 'optimism',
  AAVE: 'aave',
  MKR: 'maker',
  CRO: 'crypto-com-chain',
  OKB: 'okb',
}

// 심볼을 CoinGecko ID로 즉시 변환하는 함수 (매핑 테이블에 있는 경우만)
// 예: "BTC" → "bitcoin", 테이블에 없으면 null
export function symbolToCoinId(symbol: string): string | null {
  return SYMBOL_TO_COINGECKO[symbol.toUpperCase()] ?? null
}

// 심볼로 CoinGecko ID를 검색하는 함수 (매핑 테이블 + API 검색 조합)
// 1단계: 미리 등록된 매핑 테이블에서 찾기 (가장 빠름)
// 2단계: 캐시에서 이전 검색 결과 확인
// 3단계: CoinGecko 검색 API로 직접 조회 (가장 느림)
export async function searchCoinId(symbol: string): Promise<string | null> {
  const upper = symbol.toUpperCase()

  // 1단계: 매핑 테이블에서 즉시 찾기 (API 호출 불필요)
  const mapped = SYMBOL_TO_COINGECKO[upper]
  if (mapped) return mapped

  // 2단계: 이전에 검색한 결과가 캐시에 있으면 재사용
  if (resolvedCache.has(upper)) return resolvedCache.get(upper) ?? null

  try {
    // 3단계: CoinGecko 검색 API로 심볼 검색
    const url = `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(upper)}`
    const res = await fetch(url, { headers: { 'User-Agent': 'TRAVIS/1.0' } })
    if (!res.ok) {
      resolvedCache.set(upper, null)
      return null
    }

    const data = (await res.json()) as { coins?: Array<{ id: string; symbol: string; market_cap_rank: number | null }> }
    const coins = data.coins ?? []

    // 심볼이 정확히 일치하는 코인만 필터링 후, 시가총액 순위로 정렬
    // (같은 심볼의 코인이 여러 개일 수 있으므로 가장 큰 코인을 선택)
    const matches = coins
      .filter((c) => c.symbol.toUpperCase() === upper)
      .sort((a, b) => (a.market_cap_rank ?? 9999) - (b.market_cap_rank ?? 9999))

    // 가장 시총이 큰 코인의 ID를 캐시에 저장하고 반환
    const result = matches.length > 0 ? matches[0].id : null
    resolvedCache.set(upper, result)
    return result
  } catch (err) {
    console.error('[coingeckoApi] search failed:', err)
    resolvedCache.set(upper, null)
    return null
  }
}

// CoinGecko에서 특정 코인의 상세 데이터를 가져오는 함수
// coinId: CoinGecko 고유 ID (예: "bitcoin", "ethereum")
// 시가총액, 거래량, 공급량, ATH/ATL, 가격 변동률 등 종합 정보를 반환
export async function fetchCoinData(coinId: string): Promise<CoinData> {
  try {
    // CoinGecko 코인 상세 API 호출
    // 불필요한 데이터(로컬라이즈, 티커, 커뮤니티, 개발자 데이터)는 제외하여 응답 속도 향상
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`
    const res = await fetch(url, { headers: { 'User-Agent': 'TRAVIS/1.0' } })
    if (!res.ok) throw new Error(`CoinGecko ${res.status}`)

    const data = (await res.json()) as Record<string, unknown>
    // market_data 안에 가격, 시총, 거래량 등 핵심 데이터가 들어있음
    const md = data.market_data as Record<string, unknown> | undefined

    if (!md) throw new Error('No market_data in response')

    // CoinGecko는 다국가 통화별로 데이터를 제공 → USD 값만 추출하는 헬퍼 함수
    // 예: { usd: 50000, krw: 65000000 } → 50000
    const usd = (obj: unknown): number => {
      if (obj && typeof obj === 'object' && 'usd' in obj) return Number((obj as Record<string, unknown>).usd) || 0
      return 0
    }

    // 코인이 속한 카테고리 목록 추출 (예: "DeFi", "Layer 1", "Meme" 등)
    const rawCategories = Array.isArray(data.categories) ? (data.categories as string[]) : []

    // 모든 데이터를 CoinData 구조에 맞게 정리하여 반환
    return {
      name: String(data.name ?? ''),
      symbol: String(data.symbol ?? ''),
      marketCap: usd(md.market_cap),           // 시가총액
      volume24h: usd(md.total_volume),         // 24시간 거래량
      circulatingSupply: Number(md.circulating_supply) || 0,  // 유통량
      totalSupply: md.total_supply != null ? Number(md.total_supply) : null,  // 총 공급량
      maxSupply: md.max_supply != null ? Number(md.max_supply) : null,  // 최대 공급량 한도
      ath: usd(md.ath),                        // 역대 최고가
      athDate: String((md.ath_date as Record<string, unknown>)?.usd ?? ''),
      atl: usd(md.atl),                        // 역대 최저가
      atlDate: String((md.atl_date as Record<string, unknown>)?.usd ?? ''),
      priceChange24h: Number(md.price_change_percentage_24h) || 0,  // 24시간 변동률
      priceChange7d: Number(md.price_change_percentage_7d) || 0,    // 7일 변동률
      priceChange30d: Number(md.price_change_percentage_30d) || 0,  // 30일 변동률
      categories: rawCategories,
    }
  } catch (err) {
    console.error('[coingeckoApi] coin data fetch failed:', err)
    throw err
  }
}
