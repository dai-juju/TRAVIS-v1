// ============================================================
// 바이낸스 선물(Futures) API 모듈
// 역할: 바이낸스 선물 거래소에서 파생상품 관련 핵심 지표를 가져옴
// - 펀딩비(Funding Rate): 롱/숏 세력 균형을 보여주는 지표
// - 미결제약정(Open Interest): 시장에 열려있는 포지션 총 규모
// 사용처: 조사 모드에서 시장 심리/포지션 분석 시 사용
// ============================================================

// 펀딩비 데이터 구조 정의
export interface FundingRateData {
  symbol: string            // 거래쌍 (예: BTCUSDT)
  markPrice: number         // 마크 가격 (선물 기준 가격, 청산에 사용됨)
  lastFundingRate: number   // 최근 펀딩비 (0.0001 = 0.01%) — 양수면 롱이 숏에게 수수료 지불
  nextFundingTime: number   // 다음 펀딩비 정산 시각 (8시간마다)
}

// 미결제약정 데이터 구조 정의
export interface OpenInterestData {
  symbol: string            // 거래쌍 (예: BTCUSDT)
  openInterest: number      // 미결제약정 수량 (코인 개수 기준)
}

// 특정 코인의 펀딩비를 가져오는 함수
// 펀딩비가 높으면 = 롱(매수) 포지션이 많다 = 과열 신호일 수 있음
// 펀딩비가 음수면 = 숏(매도) 포지션이 많다 = 공포 심리일 수 있음
export async function fetchFundingRate(symbol: string): Promise<FundingRateData> {
  // 심볼에서 기준 화폐(USDT 등)를 제거하고 다시 USDT를 붙여서 통일
  // 예: "BTCUSDT" → "BTC" → "BTCUSDT", "BTC" → "BTC" → "BTCUSDT"
  const pair = symbol.toUpperCase().replace(/(USDT|BUSD|FDUSD|USD)$/i, '') + 'USDT'
  const res = await fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${pair}`)
  if (!res.ok) throw new Error(`Binance Futures funding ${res.status}`)
  const d = await res.json()
  return {
    symbol: d.symbol,
    markPrice: parseFloat(d.markPrice),
    lastFundingRate: parseFloat(d.lastFundingRate),
    nextFundingTime: d.nextFundingTime,
  }
}

// 특정 코인의 미결제약정(Open Interest)을 가져오는 함수
// 미결제약정이 증가하면 = 새로운 돈이 시장에 들어오고 있다 (관심 증가)
// 미결제약정이 감소하면 = 포지션들이 청산/종료되고 있다 (관심 감소)
export async function fetchOpenInterest(symbol: string): Promise<OpenInterestData> {
  // 심볼 정규화 (위와 동일한 로직)
  const pair = symbol.toUpperCase().replace(/(USDT|BUSD|FDUSD|USD)$/i, '') + 'USDT'
  const res = await fetch(`https://fapi.binance.com/fapi/v1/openInterest?symbol=${pair}`)
  if (!res.ok) throw new Error(`Binance Futures OI ${res.status}`)
  const d = await res.json()
  return {
    symbol: d.symbol,
    openInterest: parseFloat(d.openInterest),
  }
}
