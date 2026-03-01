// ============================================================
// Whale Activity API — AI fetch_whale_activity 도구용
// Phase 3A-5: 대형 거래(고래 활동) 탐지 (소방 호스 철학)
// Binance 최근 거래 + 호가창에서 대형 거래/벽 탐지
// trades 필수, depth 독립적 실패 허용
// ============================================================

export interface WhaleData {
  symbol: string

  // 대형 체결 내역 (Binance 최근 거래 중 대형만 필터)
  largeTrades: Array<{
    price: number
    quantity: number
    quoteQuantity: number       // USDT 금액
    time: number
    isBuyerMaker: boolean       // true = 매도 체결, false = 매수 체결
  }>

  // 대형 거래 통계
  stats: {
    totalLargeBuyVolume: number   // 대형 매수 총액 (USDT)
    totalLargeSellVolume: number  // 대형 매도 총액 (USDT)
    largeBuyCount: number         // 대형 매수 건수
    largeSellCount: number        // 대형 매도 건수
    netFlow: number               // 순 흐름 (양수 = 매수 우세)
    largestSingleTrade: number    // 최대 단일 거래 금액
  }

  // 호가 벽 (orderbook depth에서 큰 주문)
  orderBookWalls: {
    bidWalls: Array<{              // 매수벽
      price: number
      quantity: number
      totalUSDT: number
    }>
    askWalls: Array<{              // 매도벽
      price: number
      quantity: number
      totalUSDT: number
    }>
  } | null

  thresholdUSDT: number           // 대형 거래 기준선 (USDT)
  dataSource: string
  lastUpdated: string
}

/**
 * 대형 거래(고래 활동) 데이터를 조회한다.
 * 1. Binance /trades (1000건) → 대형 거래 필터 + 통계 계산
 * 2. Binance /depth (20레벨) → 호가벽 탐지
 * trades(1번) 실패 시 null, depth(2번) 실패 시 orderBookWalls만 null
 */
export async function fetchWhaleActivity(symbol?: string): Promise<WhaleData | null> {
  // 심볼 정규화
  const pair = symbol
    ? symbol.toUpperCase().replace(/(USDT|BUSD|FDUSD|USD)$/i, '') + 'USDT'
    : 'BTCUSDT'
  const baseSymbol = pair.replace('USDT', '')

  // 대형 거래 기준선 동적 결정
  const threshold = ['BTC', 'ETH'].includes(baseSymbol) ? 100000 : 50000

  try {
    const [tradesResult, depthResult] = await Promise.allSettled([
      // 1. 최근 1000개 거래
      fetch(`https://api.binance.com/api/v3/trades?symbol=${pair}&limit=1000`, {
        headers: { 'User-Agent': 'TRAVIS/1.0' },
      }).then(async (res) => {
        if (!res.ok) throw new Error(`trades ${res.status}`)
        return res.json()
      }),

      // 2. 호가창 상위 20레벨
      fetch(`https://api.binance.com/api/v3/depth?symbol=${pair}&limit=20`, {
        headers: { 'User-Agent': 'TRAVIS/1.0' },
      }).then(async (res) => {
        if (!res.ok) throw new Error(`depth ${res.status}`)
        return res.json()
      }),
    ])

    // trades는 필수 — 실패 시 전체 null
    if (tradesResult.status === 'rejected') {
      console.error(`[whaleApi] trades failed for ${pair}:`, tradesResult.reason)
      return null
    }

    const rawTrades = tradesResult.value as Array<Record<string, unknown>>

    // 대형 거래 필터
    const largeTrades: WhaleData['largeTrades'] = []
    let totalLargeBuyVolume = 0
    let totalLargeSellVolume = 0
    let largeBuyCount = 0
    let largeSellCount = 0
    let largestSingleTrade = 0

    for (const t of rawTrades) {
      const price = parseFloat(String(t.price)) || 0
      const qty = parseFloat(String(t.qty)) || 0
      const quoteQty = parseFloat(String(t.quoteQty)) || (price * qty)
      const isBuyerMaker = Boolean(t.isBuyerMaker)

      if (quoteQty >= threshold) {
        largeTrades.push({
          price,
          quantity: qty,
          quoteQuantity: quoteQty,
          time: Number(t.time) || 0,
          isBuyerMaker,
        })

        if (isBuyerMaker) {
          // isBuyerMaker = true → 매수자가 maker → 매도 체결 (taker가 매도)
          totalLargeSellVolume += quoteQty
          largeSellCount++
        } else {
          totalLargeBuyVolume += quoteQty
          largeBuyCount++
        }

        if (quoteQty > largestSingleTrade) {
          largestSingleTrade = quoteQty
        }
      }
    }

    // 시간순 정렬 (최신 먼저)
    largeTrades.sort((a, b) => b.time - a.time)

    const stats: WhaleData['stats'] = {
      totalLargeBuyVolume,
      totalLargeSellVolume,
      largeBuyCount,
      largeSellCount,
      netFlow: totalLargeBuyVolume - totalLargeSellVolume,
      largestSingleTrade,
    }

    // 호가벽 탐지 (선택적)
    let orderBookWalls: WhaleData['orderBookWalls'] = null
    if (depthResult.status === 'fulfilled') {
      const depthData = depthResult.value as { bids?: string[][]; asks?: string[][] }
      const bids = depthData.bids || []
      const asks = depthData.asks || []

      // 평균 호가 크기 계산
      const bidSizes = bids.map(([p, q]) => parseFloat(p) * parseFloat(q))
      const askSizes = asks.map(([p, q]) => parseFloat(p) * parseFloat(q))
      const avgBidSize = bidSizes.length > 0 ? bidSizes.reduce((a, b) => a + b, 0) / bidSizes.length : 0
      const avgAskSize = askSizes.length > 0 ? askSizes.reduce((a, b) => a + b, 0) / askSizes.length : 0

      // 평균의 3배 이상이면 "벽"
      const bidWalls = bids
        .map(([p, q]) => {
          const price = parseFloat(p)
          const quantity = parseFloat(q)
          const totalUSDT = price * quantity
          return { price, quantity, totalUSDT }
        })
        .filter((w) => w.totalUSDT >= avgBidSize * 3 && w.totalUSDT >= 10000)

      const askWalls = asks
        .map(([p, q]) => {
          const price = parseFloat(p)
          const quantity = parseFloat(q)
          const totalUSDT = price * quantity
          return { price, quantity, totalUSDT }
        })
        .filter((w) => w.totalUSDT >= avgAskSize * 3 && w.totalUSDT >= 10000)

      orderBookWalls = { bidWalls, askWalls }
    } else {
      console.warn(`[whaleApi] depth failed for ${pair}:`, depthResult.reason)
    }

    return {
      symbol: baseSymbol,
      largeTrades,
      stats,
      orderBookWalls,
      thresholdUSDT: threshold,
      dataSource: 'binance',
      lastUpdated: new Date().toISOString(),
    }
  } catch (err) {
    console.error('[whaleApi] fetchWhaleActivity failed:', err)
    return null
  }
}
