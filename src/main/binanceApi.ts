// ============================================================
// 바이낸스(Binance) 현물 거래소 REST API 모듈
// 역할: 세계 최대 암호화폐 거래소인 바이낸스에서 실시간 거래 데이터를 가져옴
// 사용처: 조사 모드(Investigation Mode)에서 코인 분석 시 거래 내역 및 시세 표시
// ============================================================

// 개별 거래(체결) 데이터의 구조 정의
export interface TradeData {
  id: number           // 거래 고유 번호
  price: string        // 체결 가격
  qty: string          // 거래 수량 (코인 개수)
  quoteQty: string     // 거래 금액 (USDT 등 기준 화폐)
  time: number         // 거래 시각 (밀리초 타임스탬프)
  isBuyerMaker: boolean  // true=매도 체결(매수자가 시장가 매수), false=매수 체결
}

// 24시간 시세 요약 데이터의 구조 정의
export interface TickerSummary {
  price: string   // 현재 가격
  change: string  // 24시간 가격 변동률 (%)
  volume: string  // 24시간 거래량 (USDT 기준)
}

// 바이낸스에서 특정 코인의 최근 거래(체결) 내역을 가져오는 함수 (기본 500건)
// symbol: 코인 심볼 (예: "BTC", "ETH")
// 여러 거래쌍(USDT, BTC, FDUSD)을 순서대로 시도해서 가장 먼저 성공하는 것을 사용
export async function fetchRecentTrades(
  symbol: string,
  limit: number = 500
): Promise<{ trades: TradeData[]; pair: string }> {
  // 시도할 기준 화폐 목록 (USDT를 먼저, 없으면 BTC나 FDUSD 시도)
  const quotes = ['USDT', 'BTC', 'FDUSD']

  for (const quote of quotes) {
    try {
      // 거래쌍 조합 (예: BTC + USDT = BTCUSDT)
      const pair = `${symbol}${quote}`
      const url = `https://api.binance.com/api/v3/trades?symbol=${pair}&limit=${limit}`
      const res = await fetch(url, { headers: { 'User-Agent': 'TRAVIS/1.0' } })
      if (!res.ok) continue  // 이 거래쌍이 없으면 다음 기준 화폐로 시도

      // API 응답을 TradeData 형식으로 변환
      const data = (await res.json()) as Array<Record<string, unknown>>
      const trades = data.map((t) => ({
        id: Number(t.id),
        price: String(t.price),
        qty: String(t.qty),
        quoteQty: String(t.quoteQty),
        time: Number(t.time),
        isBuyerMaker: Boolean(t.isBuyerMaker),
      }))
      return { trades, pair }  // 성공하면 거래 데이터와 사용된 거래쌍을 반환
    } catch {
      continue  // 오류 발생 시 다음 기준 화폐로 시도
    }
  }

  // 모든 거래쌍에서 실패하면 에러 발생
  throw new Error(`No trade data for ${symbol} on any pair`)
}

// 여러 코인의 24시간 시세 요약을 한 번에 가져오는 함수
// symbols: 코인 심볼 배열 (예: ["BTC", "ETH", "SOL"])
// 모든 코인을 동시에(병렬로) 조회하여 속도를 높임
export async function fetchMultipleTickers(
  symbols: string[]
): Promise<Record<string, TickerSummary>> {
  const results: Record<string, TickerSummary> = {}

  // 각 코인별로 병렬 API 요청 생성
  const promises = symbols.map(async (sym) => {
    try {
      // 24시간 통계 API 호출 (가격, 변동률, 거래량 포함)
      const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${sym}USDT`
      const res = await fetch(url, { headers: { 'User-Agent': 'TRAVIS/1.0' } })
      if (!res.ok) return { sym, data: null }

      const data = (await res.json()) as Record<string, unknown>
      return {
        sym,
        data: {
          price: String(data.lastPrice ?? '0'),           // 현재 가격
          change: String(data.priceChangePercent ?? '0'),  // 24시간 변동률 (%)
          volume: String(data.quoteVolume ?? '0'),         // 24시간 거래량 (USDT)
        },
      }
    } catch {
      return { sym, data: null }  // 개별 코인 조회 실패 시 null 반환 (다른 코인에 영향 없음)
    }
  })

  // 모든 병렬 요청의 결과를 수집 (일부 실패해도 나머지 결과는 유지)
  const settled = await Promise.allSettled(promises)
  for (const result of settled) {
    if (result.status === 'fulfilled' && result.value.data) {
      results[result.value.sym] = result.value.data
    }
  }

  return results
}
