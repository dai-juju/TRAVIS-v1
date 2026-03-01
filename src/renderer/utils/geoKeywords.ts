// 지역(지리) 키워드 매핑 유틸리티
// 뉴스 제목이나 출처에서 키워드를 찾아 해당 뉴스가 어느 나라/도시와 관련된지 파악
// 세계 지도에 뉴스 핀을 찍을 때 사용됨

// 지리 위치 정보 구조
export interface GeoLocation {
  name: string                     // 도시/지역 이름 (예: 'Seoul', 'Washington DC')
  coordinates: [number, number]    // [경도, 위도] — 지도에서의 위치
}

// 키워드 → 위치 매핑 테이블
// 뉴스에 이 키워드가 포함되면 해당 위치로 매핑됨
const KEYWORD_MAP: Array<{ keywords: string[]; location: GeoLocation }> = [
  {
    // 미국 관련 키워드 — SEC(증권거래위원회), Fed(연방준비제도), 의회 등
    keywords: ['US', 'SEC', 'Fed', 'Federal Reserve', 'Senate', 'Congress', 'CFTC', 'Treasury'],
    location: { name: 'Washington DC', coordinates: [-77.0, 38.9] },
  },
  {
    // 중국/홍콩 관련 키워드
    keywords: ['China', 'Hong Kong', 'HKMA'],
    location: { name: 'Hong Kong', coordinates: [114.2, 22.3] },
  },
  {
    // 유럽연합 관련 키워드 — ECB(유럽중앙은행), MiCA(암호화폐 규제법)
    keywords: ['EU', 'ECB', 'MiCA', 'European'],
    location: { name: 'Frankfurt', coordinates: [8.7, 50.1] },
  },
  {
    // 일본 관련 키워드 — BOJ(일본은행)
    keywords: ['Japan', 'BOJ'],
    location: { name: 'Tokyo', coordinates: [139.7, 35.7] },
  },
  {
    // 한국 관련 키워드 — Upbit(업비트 거래소)
    keywords: ['Korea', 'Upbit'],
    location: { name: 'Seoul', coordinates: [127.0, 37.6] },
  },
  {
    // 바이낸스 거래소 (본사: 두바이)
    keywords: ['Binance'],
    location: { name: 'Dubai', coordinates: [55.3, 25.2] },
  },
  {
    // 영국 관련 키워드 — BOE(영란은행), FCA(금융행위감독청)
    keywords: ['UK', 'BOE', 'FCA', 'London'],
    location: { name: 'London', coordinates: [-0.1, 51.5] },
  },
  {
    // 싱가포르 관련 키워드 — MAS(싱가포르 통화청)
    keywords: ['Singapore', 'MAS'],
    location: { name: 'Singapore', coordinates: [103.8, 1.35] },
  },
  {
    // 호주 관련 키워드 — RBA(호주중앙은행)
    keywords: ['Australia', 'RBA'],
    location: { name: 'Sydney', coordinates: [151.2, -33.9] },
  },
  {
    // 브라질 관련 키워드
    keywords: ['Brazil'],
    location: { name: 'Brasilia', coordinates: [-47.9, -15.8] },
  },
  {
    // 인도 관련 키워드 — RBI(인도준비은행)
    keywords: ['India', 'RBI'],
    location: { name: 'Mumbai', coordinates: [72.9, 19.1] },
  },
  {
    // 러시아 관련 키워드
    keywords: ['Russia'],
    location: { name: 'Moscow', coordinates: [37.6, 55.8] },
  },
  {
    // 스위스 관련 키워드 — SNB(스위스국립은행)
    keywords: ['Switzerland', 'SNB'],
    location: { name: 'Zurich', coordinates: [8.5, 47.4] },
  },
  {
    // 코인베이스 거래소 (본사: 샌프란시스코)
    keywords: ['Coinbase'],
    location: { name: 'San Francisco', coordinates: [-122.4, 37.8] },
  },
  {
    // OKX 거래소 (등록지: 세이셸)
    keywords: ['OKX'],
    location: { name: 'Seychelles', coordinates: [55.5, -4.7] },
  },
]

// 뉴스 제목과 출처에서 키워드를 찾아 해당 지역 위치를 반환하는 함수
// 세계 지도에 뉴스를 핀으로 표시할 때 사용
// 단어 경계(word boundary)를 사용해 오탐 방지 (예: "insecure"에서 "SEC"이 잘못 매칭되지 않도록)
// 짧은 대문자 키워드(US, UK 등)는 대소문자 구분 매칭
export function extractLocation(title: string, source: string): GeoLocation | null {
  const text = `${title} ${source}`

  for (const entry of KEYWORD_MAP) {
    for (const keyword of entry.keywords) {
      // 3글자 이하의 대문자 키워드는 대소문자를 엄격히 구분 (오탐 방지)
      const isShortUpper = keyword.length <= 3 && keyword === keyword.toUpperCase()
      const flags = isShortUpper ? '' : 'i'  // 짧은 대문자: 대소문자 구분 / 긴 키워드: 무시
      const regex = new RegExp(`\\b${escapeRegex(keyword)}\\b`, flags)
      if (regex.test(text)) {
        return entry.location  // 첫 번째로 매칭되는 위치 반환
      }
    }
  }

  return null  // 매칭되는 키워드가 없으면 null
}

// 지역 이름으로 좌표를 조회하는 함수
// 예: 'Seoul' → [127.0, 37.6]
export function getCoordinates(locationName: string): [number, number] | null {
  for (const entry of KEYWORD_MAP) {
    if (entry.location.name === locationName) {
      return entry.location.coordinates
    }
  }
  return null  // 매핑에 없는 지역이면 null
}

// 정규식 특수문자 이스케이프 유틸리티
// 키워드에 정규식 특수문자(., *, + 등)가 있을 때 안전하게 처리
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
