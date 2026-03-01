// ============================================================
// 업비트(Upbit) 김치 프리미엄 API 모듈
// 역할: 한국 거래소(업비트)와 해외 거래소(바이낸스)의 가격 차이를 계산
// "김치 프리미엄" = 한국에서 코인이 해외보다 비싸게 거래되는 현상
// 예: 바이낸스 BTC = $50,000인데 업비트 BTC = $51,500이면 → 김치 프리미엄 3%
// 이 수치가 높으면 한국 투자자들의 매수 열기가 강하다는 신호
// ============================================================

// 김치 프리미엄 데이터 구조 정의
export interface KimchiPremiumData {
  symbol: string          // 코인 심볼 (예: "BTC")
  upbitPriceKRW: number   // 업비트 가격 (원화, KRW)
  exchangeRate: number    // USD→KRW 환율
  upbitPriceUSD: number   // 업비트 가격을 달러로 환산한 값
  premiumPercent: number  // 김치 프리미엄 비율 (%) — 양수면 한국이 더 비쌈
  binancePriceUSD: number // 바이낸스 가격 (달러, USD)
}

// 업비트에서 지원하는 코인 목록 (KRW 마켓에 상장된 주요 코인)
const UPBIT_SYMBOLS = ['BTC', 'ETH', 'XRP', 'SOL', 'DOGE', 'ADA']

// USD→KRW 환율 캐시 (5분 동안 유지 — 환율은 자주 바뀌지 않으므로)
let cachedRate: { rate: number; time: number } | null = null
const RATE_CACHE_MS = 5 * 60 * 1000  // 5분 = 300,000 밀리초

// 현재 USD→KRW 환율을 가져오는 함수
// 캐시가 유효하면 API 호출 없이 캐시된 값을 반환 (불필요한 API 호출 방지)
async function getExchangeRate(): Promise<number> {
  // 캐시가 있고, 5분이 안 지났으면 캐시된 환율 반환
  if (cachedRate && Date.now() - cachedRate.time < RATE_CACHE_MS) {
    return cachedRate.rate
  }
  // 환율 API에서 최신 USD→KRW 환율 조회
  const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD')
  if (!res.ok) throw new Error(`Exchange rate API ${res.status}`)
  const data = await res.json()
  const rate = data.rates?.KRW
  if (!rate) throw new Error('KRW rate not found')
  // 조회 결과를 캐시에 저장 (다음 5분간 재사용)
  cachedRate = { rate, time: Date.now() }
  return rate
}

// 김치 프리미엄을 계산하는 메인 함수
// symbols: 계산할 코인 목록 (미지정 시 기본 6개 코인 전체)
// 계산 과정: 환율 조회 → 업비트 가격 조회 → 바이낸스 가격 조회 → 차이 계산
export async function fetchKimchiPremium(
  symbols?: string[]
): Promise<Record<string, KimchiPremiumData>> {
  // 요청된 심볼 중 업비트에서 지원하는 것만 필터링
  const targetSymbols = (symbols ?? UPBIT_SYMBOLS).filter((s) =>
    UPBIT_SYMBOLS.includes(s.toUpperCase())
  ).map((s) => s.toUpperCase())

  if (targetSymbols.length === 0) return {}

  // 3가지 데이터를 동시에(병렬로) 가져옴 — 속도 최적화
  // 1) 환율 2) 업비트 시세 3) 바이낸스 시세
  const upbitMarkets = targetSymbols.map((s) => `KRW-${s}`).join(',')  // 업비트 형식: "KRW-BTC,KRW-ETH"
  const binanceSymbols = JSON.stringify(targetSymbols.map((s) => `${s}USDT`))  // 바이낸스 형식: ["BTCUSDT","ETHUSDT"]

  const [rate, upbitRes, binanceRes] = await Promise.all([
    getExchangeRate(),  // USD→KRW 환율
    fetch(`https://api.upbit.com/v1/ticker?markets=${upbitMarkets}`),  // 업비트 시세 (KRW)
    fetch(`https://api.binance.com/api/v3/ticker/price?symbols=${encodeURIComponent(binanceSymbols)}`),  // 바이낸스 시세 (USD)
  ])

  if (!upbitRes.ok) throw new Error(`Upbit API ${upbitRes.status}`)
  if (!binanceRes.ok) throw new Error(`Binance API ${binanceRes.status}`)

  const upbitData: Array<{ market: string; trade_price: number }> = await upbitRes.json()
  const binanceData: Array<{ symbol: string; price: string }> = await binanceRes.json()

  // 빠른 검색을 위해 코인별 가격을 Map(사전)으로 변환
  // 업비트 가격 맵: "BTC" → 87000000 (원화)
  const upbitMap = new Map<string, number>()
  for (const item of upbitData) {
    const sym = item.market.replace('KRW-', '')
    upbitMap.set(sym, item.trade_price)
  }

  // 바이낸스 가격 맵: "BTC" → 67000 (달러)
  const binanceMap = new Map<string, number>()
  for (const item of binanceData) {
    const sym = item.symbol.replace('USDT', '')
    binanceMap.set(sym, parseFloat(item.price))
  }

  const result: Record<string, KimchiPremiumData> = {}

  // 각 코인별로 김치 프리미엄 계산
  for (const sym of targetSymbols) {
    const upbitKRW = upbitMap.get(sym)
    const binanceUSD = binanceMap.get(sym)
    // 두 거래소 모두 가격이 있어야 계산 가능
    if (upbitKRW == null || binanceUSD == null || binanceUSD === 0) continue

    // 업비트 원화 가격을 달러로 환산
    const upbitUSD = upbitKRW / rate
    // 프리미엄 계산: (업비트 달러 가격 - 바이낸스 달러 가격) / 바이낸스 달러 가격 × 100
    const premium = ((upbitUSD - binanceUSD) / binanceUSD) * 100

    result[sym] = {
      symbol: sym,
      upbitPriceKRW: upbitKRW,
      exchangeRate: rate,
      upbitPriceUSD: upbitUSD,
      premiumPercent: premium,    // 이 값이 양수면 한국이 비쌈, 음수면 한국이 쌈
      binancePriceUSD: binanceUSD,
    }
  }

  return result
}
