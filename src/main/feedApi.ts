// ============================================================
// 뉴스 피드 API 모듈
// 역할: 암호화폐 관련 뉴스와 시장 심리 지표를 외부 API에서 가져옴
// 1) CryptoCompare: 암호화폐 뉴스 기사 (최신 30건)
// 2) Alternative.me: 공포&탐욕 지수 (시장 심리를 0~100 숫자로 표현)
// 사용처: 왼쪽 뉴스 피드 패널과 FEED 탭에서 표시
// ============================================================

// 개별 뉴스 기사 데이터 구조 정의
export interface CryptoNewsItem {
  title: string       // 뉴스 제목
  url: string         // 원문 링크
  source: string      // 출처 (예: "CoinDesk", "CoinTelegraph")
  body: string        // 본문 요약 (최대 200자)
  timestamp: number   // 발행 시각 (밀리초 타임스탬프)
  categories: string  // 카테고리 (예: "BTC|Trading|Regulation")
}

// 공포&탐욕 지수 데이터 구조 정의
// 0 = 극도의 공포 (시장 패닉), 100 = 극도의 탐욕 (시장 과열)
export interface FearGreedData {
  value: number          // 지수 값 (0~100)
  classification: string // 분류명 (예: "Extreme Fear", "Greed", "Neutral")
  timestamp: number      // 측정 시각
}

// CryptoCompare에서 최신 암호화폐 뉴스 30건을 가져오는 함수
// 영문(EN) 뉴스만 가져오며, 본문은 200자로 잘라서 미리보기용으로 사용
export async function fetchCryptoNews(): Promise<CryptoNewsItem[]> {
  try {
    const res = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN&limit=30', {
      headers: { 'User-Agent': 'TRAVIS/1.0' },
    })

    if (!res.ok) throw new Error(`CryptoCompare ${res.status}`)

    const data = await res.json()
    const articles = (data?.Data ?? []) as Array<Record<string, unknown>>

    // API 응답을 CryptoNewsItem 형식으로 변환
    return articles.map((item) => ({
      title: String(item.title ?? ''),
      url: String(item.url ?? ''),
      source: String(item.source ?? 'CryptoCompare'),
      body: String(item.body ?? '').slice(0, 200),  // 본문을 200자로 자름 (미리보기)
      timestamp: Number(item.published_on ?? 0) * 1000,  // 초 → 밀리초 변환
      categories: String(item.categories ?? ''),
    }))
  } catch (err) {
    // 뉴스 가져오기 실패 시 빈 배열 반환 (앱이 멈추지 않도록)
    console.error('[feedApi] CryptoCompare news fetch failed:', err)
    return []
  }
}

// 공포&탐욕 지수(Fear & Greed Index)를 가져오는 함수
// 이 지수는 시장 전체의 심리를 하나의 숫자로 보여줌
// 워렌 버핏: "남들이 두려워할 때 탐욕을 부려라" — 이 지수가 낮으면 매수 기회일 수 있음
export async function fetchFearGreed(): Promise<FearGreedData | null> {
  try {
    // Alternative.me API에서 최신 1건의 지수 데이터 요청
    const res = await fetch('https://api.alternative.me/fng/?limit=1')

    if (!res.ok) throw new Error(`FearGreed ${res.status}`)

    const data = await res.json()
    const entry = data?.data?.[0]
    if (!entry) return null  // 데이터가 없으면 null 반환

    return {
      value: Number(entry.value),                      // 지수 값 (0~100)
      classification: String(entry.value_classification), // 분류 (Fear, Greed 등)
      timestamp: Number(entry.timestamp) * 1000,        // 초 → 밀리초 변환
    }
  } catch (err) {
    // 실패 시 null 반환 (앱이 멈추지 않도록)
    console.error('[feedApi] Fear & Greed fetch failed:', err)
    return null
  }
}
