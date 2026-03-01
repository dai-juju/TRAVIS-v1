// ============================================================
// Derivatives API — AI fetch_derivatives_data 도구용
// Phase 3A-4: 선물/파생상품 시장 종합 데이터 (소방 호스 철학)
// 8개 바이낸스 선물 API를 Promise.allSettled로 병렬 호출
// premiumIndex만 성공해도 기본 데이터 반환, 나머지는 독립적 실패
// ============================================================

export interface DerivativesData {
  symbol: string

  // 가격 데이터
  markPrice: number
  indexPrice: number
  lastFundingRate: number       // 마지막 펀딩비 (예: 0.0001 = 0.01%)
  nextFundingTime: number       // 다음 펀딩 시간 (timestamp)
  interestRate: number          // 이자율

  // 미결제약정
  openInterest: number          // OI (코인 수량)
  openInterestUSDT: number      // OI (USDT 환산, 수량 × 마크가격)

  // 글로벌 롱숏 비율 (계좌 기준)
  globalLongShortRatio: {
    longAccount: number
    shortAccount: number
    longShortRatio: number
    timestamp: number
  } | null

  // 탑 트레이더 롱숏 (포지션 기준)
  topTraderPositionRatio: {
    longAccount: number
    shortAccount: number
    longShortRatio: number
    timestamp: number
  } | null

  // 탑 트레이더 롱숏 (계좌 기준)
  topTraderAccountRatio: {
    longAccount: number
    shortAccount: number
    longShortRatio: number
    timestamp: number
  } | null

  // 테이커 매수/매도 비율
  takerBuySellRatio: {
    buySellRatio: number        // >1이면 매수 우세
    buyVol: number
    sellVol: number
    timestamp: number
  } | null

  // OI 변화 추이 (최근 12시간, 1시간 간격)
  oiHistory: Array<{
    sumOpenInterest: number
    sumOpenInterestValue: number
    timestamp: number
  }> | null

  // 최근 대규모 청산 (최근 10건)
  recentLiquidations: Array<{
    symbol: string
    side: string                // "BUY" (숏 청산) or "SELL" (롱 청산)
    price: number
    quantity: number
    quoteQuantity: number       // USDT 금액
    time: number
  }> | null

  dataSource: string
  lastUpdated: string
}

// 롱숏 비율 응답 파싱 헬퍼
function parseLongShortRatio(data: Array<Record<string, string>> | null): {
  longAccount: number
  shortAccount: number
  longShortRatio: number
  timestamp: number
} | null {
  if (!data || !Array.isArray(data) || data.length === 0) return null
  const d = data[0]
  return {
    longAccount: parseFloat(d.longAccount) || 0,
    shortAccount: parseFloat(d.shortAccount) || 0,
    longShortRatio: parseFloat(d.longShortRatio) || 0,
    timestamp: Number(d.timestamp) || 0,
  }
}

/**
 * 특정 코인의 선물/파생상품 종합 데이터를 조회한다.
 * 8개 바이낸스 선물 API를 Promise.allSettled로 병렬 호출.
 * premiumIndex(1번)만 필수 — 나머지는 독립적으로 실패해도 null 처리.
 */
export async function fetchDerivativesData(symbol: string): Promise<DerivativesData | null> {
  // 심볼 정규화: 대문자 + USDT
  const pair = symbol.toUpperCase().replace(/(USDT|BUSD|FDUSD|USD)$/i, '') + 'USDT'
  const base = pair.replace('USDT', '')

  try {
    const [
      premiumResult,
      oiResult,
      globalLsResult,
      topPosResult,
      topAccResult,
      takerResult,
      oiHistResult,
      liqResult,
    ] = await Promise.allSettled([
      // 1. premiumIndex — 마크가격, 인덱스가격, 펀딩비, 이자율
      fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${pair}`)
        .then(async (res) => {
          if (!res.ok) throw new Error(`premiumIndex ${res.status}`)
          return res.json()
        }),

      // 2. openInterest — 미결제약정
      fetch(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${pair}`)
        .then(async (res) => {
          if (!res.ok) throw new Error(`openInterest ${res.status}`)
          return res.json()
        }),

      // 3. globalLongShortAccountRatio — 글로벌 롱숏
      fetch(`https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${pair}&period=1h&limit=1`)
        .then(async (res) => {
          if (!res.ok) throw new Error(`globalLS ${res.status}`)
          return res.json()
        }),

      // 4. topLongShortPositionRatio — 탑 트레이더 포지션
      fetch(`https://fapi.binance.com/futures/data/topLongShortPositionRatio?symbol=${pair}&period=1h&limit=1`)
        .then(async (res) => {
          if (!res.ok) throw new Error(`topPos ${res.status}`)
          return res.json()
        }),

      // 5. topLongShortAccountRatio — 탑 트레이더 계좌
      fetch(`https://fapi.binance.com/futures/data/topLongShortAccountRatio?symbol=${pair}&period=1h&limit=1`)
        .then(async (res) => {
          if (!res.ok) throw new Error(`topAcc ${res.status}`)
          return res.json()
        }),

      // 6. takerlongshortRatio — 테이커 매수/매도
      fetch(`https://fapi.binance.com/futures/data/takerlongshortRatio?symbol=${pair}&period=1h&limit=1`)
        .then(async (res) => {
          if (!res.ok) throw new Error(`taker ${res.status}`)
          return res.json()
        }),

      // 7. openInterestHist — OI 변화 추이 (12시간)
      fetch(`https://fapi.binance.com/futures/data/openInterestHist?symbol=${pair}&period=1h&limit=12`)
        .then(async (res) => {
          if (!res.ok) throw new Error(`oiHist ${res.status}`)
          return res.json()
        }),

      // 8. allForceOrders — 최근 청산 (접근 제한 가능)
      fetch(`https://fapi.binance.com/fapi/v1/allForceOrders?symbol=${pair}&limit=10`)
        .then(async (res) => {
          if (!res.ok) throw new Error(`liquidations ${res.status}`)
          return res.json()
        }),
    ])

    // premiumIndex는 필수 — 실패 시 전체 null
    if (premiumResult.status === 'rejected') {
      console.error(`[derivativesApi] premiumIndex failed for ${pair}:`, premiumResult.reason)
      return null
    }

    const premium = premiumResult.value as Record<string, string>
    const markPrice = parseFloat(premium.markPrice) || 0
    const indexPrice = parseFloat(premium.indexPrice) || 0
    const lastFundingRate = parseFloat(premium.lastFundingRate) || 0
    const nextFundingTime = Number(premium.nextFundingTime) || 0
    const interestRate = parseFloat(premium.interestRate) || 0

    // OI 파싱 (선택적)
    let openInterest = 0
    if (oiResult.status === 'fulfilled') {
      const oiData = oiResult.value as Record<string, string>
      openInterest = parseFloat(oiData.openInterest) || 0
    } else {
      console.warn(`[derivativesApi] openInterest failed for ${pair}:`, oiResult.reason)
    }

    // 글로벌 롱숏 비율
    const globalLongShortRatio = globalLsResult.status === 'fulfilled'
      ? parseLongShortRatio(globalLsResult.value as Array<Record<string, string>>)
      : null
    if (globalLsResult.status === 'rejected') {
      console.warn(`[derivativesApi] globalLS failed:`, globalLsResult.reason)
    }

    // 탑 트레이더 포지션 롱숏
    const topTraderPositionRatio = topPosResult.status === 'fulfilled'
      ? parseLongShortRatio(topPosResult.value as Array<Record<string, string>>)
      : null

    // 탑 트레이더 계좌 롱숏
    const topTraderAccountRatio = topAccResult.status === 'fulfilled'
      ? parseLongShortRatio(topAccResult.value as Array<Record<string, string>>)
      : null

    // 테이커 매수/매도 비율
    let takerBuySellRatio: DerivativesData['takerBuySellRatio'] = null
    if (takerResult.status === 'fulfilled') {
      const takerArr = takerResult.value as Array<Record<string, string>>
      if (Array.isArray(takerArr) && takerArr.length > 0) {
        const t = takerArr[0]
        takerBuySellRatio = {
          buySellRatio: parseFloat(t.buySellRatio) || 0,
          buyVol: parseFloat(t.buyVol) || 0,
          sellVol: parseFloat(t.sellVol) || 0,
          timestamp: Number(t.timestamp) || 0,
        }
      }
    }

    // OI 변화 추이
    let oiHistory: DerivativesData['oiHistory'] = null
    if (oiHistResult.status === 'fulfilled') {
      const histArr = oiHistResult.value as Array<Record<string, string>>
      if (Array.isArray(histArr) && histArr.length > 0) {
        oiHistory = histArr.map((h) => ({
          sumOpenInterest: parseFloat(h.sumOpenInterest) || 0,
          sumOpenInterestValue: parseFloat(h.sumOpenInterestValue) || 0,
          timestamp: Number(h.timestamp) || 0,
        }))
      }
    }

    // 최근 청산
    let recentLiquidations: DerivativesData['recentLiquidations'] = null
    if (liqResult.status === 'fulfilled') {
      const liqArr = liqResult.value as Array<Record<string, unknown>>
      if (Array.isArray(liqArr) && liqArr.length > 0) {
        recentLiquidations = liqArr.map((l) => ({
          symbol: String(l.symbol || pair),
          side: String(l.side || ''),
          price: parseFloat(String(l.price)) || 0,
          quantity: parseFloat(String(l.origQty || l.quantity)) || 0,
          quoteQuantity: parseFloat(String(l.price)) * parseFloat(String(l.origQty || l.quantity)) || 0,
          time: Number(l.time) || 0,
        }))
      }
    }

    return {
      symbol: base,
      markPrice,
      indexPrice,
      lastFundingRate,
      nextFundingTime,
      interestRate,
      openInterest,
      openInterestUSDT: openInterest * markPrice,
      globalLongShortRatio,
      topTraderPositionRatio,
      topTraderAccountRatio,
      takerBuySellRatio,
      oiHistory,
      recentLiquidations,
      dataSource: 'binance-futures',
      lastUpdated: new Date().toISOString(),
    }
  } catch (err) {
    console.error('[derivativesApi] fetchDerivativesData failed:', err)
    return null
  }
}
