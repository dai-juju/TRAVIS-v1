// ============================================================
// Yahoo Finance API 모듈
// 역할: 전통자산(주식 지수, 금, 원유, 달러 인덱스)의 실시간 시세를 가져옴
// Yahoo Finance v8 Chart API 사용 (무료, API 키 불필요)
// 사용처: 하단 가격 티커에서 전통자산 시세를 표시
// 트레이더는 암호화폐뿐 아니라 전통 시장도 함께 봐야 하므로 필수 데이터
// ============================================================

// TRAVIS 내부 심볼 → Yahoo Finance 심볼 매핑 테이블
// Yahoo Finance는 특수 문자를 URL 인코딩해서 사용 (^, = 등)
const SYMBOL_MAP: Record<string, string> = {
  SPX: '%5EGSPC',       // S&P 500 지수 (미국 대형주 500개 대표 지수)
  NASDAQ: '%5EIXIC',    // 나스닥 종합 지수 (기술주 중심)
  DXY: 'DX-Y.NYB',     // 달러 인덱스 (미국 달러의 강세/약세 지표)
  GOLD: 'GC%3DF',       // 금 선물 가격 (안전자산 대표)
  OIL: 'CL%3DF',        // 원유(WTI) 선물 가격
}

// 개별 전통자산 시세 데이터 구조 정의
export interface TradFiQuote {
  symbol: string  // 자산 심볼 (예: "SPX", "GOLD")
  price: number   // 현재 가격
  change: number  // 24시간 가격 변동률 (%)
}

// 전체 자산의 시세 결과 타입 — 각 자산별로 시세 또는 null(실패 시)
export type TradFiResult = Record<string, TradFiQuote | null>

// 개별 자산 하나의 시세를 가져오는 함수
// internalSymbol: TRAVIS에서 사용하는 이름 (예: "SPX")
// yahooSymbol: Yahoo Finance API에서 사용하는 이름 (예: "%5EGSPC")
async function fetchSingleQuote(
  internalSymbol: string,
  yahooSymbol: string
): Promise<TradFiQuote | null> {
  try {
    // Yahoo Finance 차트 API에서 당일(1d) 데이터 요청
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?range=1d&interval=1d`
    const res = await fetch(url, {
      headers: {
        // 브라우저처럼 보이게 User-Agent 설정 (API 차단 방지)
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    if (!res.ok) return null  // 요청 실패 시 null 반환

    const data = await res.json()
    // 응답에서 메타 정보(가격, 전일 종가) 추출
    const meta = data?.chart?.result?.[0]?.meta
    if (!meta) return null

    const price = meta.regularMarketPrice       // 현재 시장 가격
    const prevClose = meta.chartPreviousClose ?? meta.previousClose  // 전일 종가
    if (typeof price !== 'number') return null

    // 변동률 계산: (현재가 - 전일종가) / 전일종가 × 100
    const change = prevClose ? ((price - prevClose) / prevClose) * 100 : 0

    return { symbol: internalSymbol, price, change }
  } catch {
    return null  // 네트워크 오류 등 발생 시 null 반환 (다른 자산에 영향 없음)
  }
}

// 모든 전통자산의 시세를 한 번에 가져오는 함수
// 5개 자산(S&P 500, 나스닥, 달러인덱스, 금, 원유)을 동시에(병렬로) 조회
export async function fetchTraditionalAssets(): Promise<TradFiResult> {
  const entries = Object.entries(SYMBOL_MAP)
  // Promise.allSettled: 일부 자산이 실패해도 나머지 결과는 정상 반환
  const results = await Promise.allSettled(
    entries.map(([key, yahoo]) => fetchSingleQuote(key, yahoo))
  )

  // 결과를 { SPX: {...}, GOLD: {...}, ... } 형태로 정리
  const out: TradFiResult = {}
  results.forEach((r, i) => {
    const key = entries[i][0]
    out[key] = r.status === 'fulfilled' ? r.value : null  // 성공하면 데이터, 실패하면 null
  })
  return out
}
