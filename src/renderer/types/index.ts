// ====================================================================
// TRAVIS 앱 전체에서 사용하는 공통 타입 정의 파일
// 모든 컴포넌트, 서비스, 저장소가 이 파일의 타입을 참조함
// TypeScript의 타입 = 데이터의 "설계도" (어떤 속성이 어떤 형태인지 정의)
// ====================================================================

// --- AI 도구 호출 결과 ---
// Claude AI가 도구를 호출하면 이 형태로 파싱됨
export interface ToolCall {
  id: string                         // 도구 호출 고유 ID
  name: string                       // 도구 이름 (예: 'spawn_card', 'search_web')
  input: Record<string, unknown>     // 도구에 전달되는 입력 데이터
}

// --- 캔버스 아이템 (카드 + 웹뷰) ---

// 정보 카드 — AI가 분석 결과를 표시하는 카드
export interface CardData {
  id: string                                            // 카드 고유 ID
  type: 'card'                                          // 아이템 유형 표시 (항상 'card')
  title: string                                         // 카드 제목
  content: string                                       // 카드 내용 (마크다운 형식)
  cardType?: string                                     // 카드 종류 (analysis, data, summary, comparison, news, price)
  symbol?: string                                       // 관련 코인 심볼 (예: 'BTC', 'ETH') — 있으면 실시간 시세 연동
  images?: Array<{ url: string; caption?: string }>     // 이미지 목록 (선택사항)
  x: number                                             // 캔버스 위 X 좌표 (가로 위치)
  y: number                                             // 캔버스 위 Y 좌표 (세로 위치)
  width: number                                         // 카드 너비 (px)
  height: number                                        // 카드 높이 (px)
  spawnDelay?: number                                   // 생성 애니메이션 딜레이 (초) — 여러 카드 순차 등장 효과
  isLoading?: boolean                                    // true이면 스켈레톤 상태로 렌더링 (데이터 로딩 중)
}

// 웹뷰 카드 — 웹사이트를 캔버스에 직접 임베드
export interface WebviewData {
  id: string                  // 웹뷰 고유 ID
  type: 'webview'             // 아이템 유형 표시 (항상 'webview')
  url: string                 // 임베드할 웹사이트 URL
  title: string               // 표시 제목
  x: number                   // 캔버스 위 X 좌표
  y: number                   // 캔버스 위 Y 좌표
  width: number               // 웹뷰 너비
  height: number              // 웹뷰 높이
  liveTitle?: string          // 웹뷰 내부 페이지의 실제 제목 (페이지 이동 시 업데이트)
  liveUrl?: string            // 웹뷰 내부의 실제 URL (페이지 이동 시 업데이트)
}

// 캔버스 아이템 — 카드 또는 웹뷰 중 하나
export type CanvasItem = CardData | WebviewData

// --- 카드 간 연결선 (Edge) ---

// 연결 강도 — 두 카드 사이의 관계 강도를 나타냄
export type EdgeStrength = 'strong' | 'weak' | 'speculative'
// strong: 강한 연관 (같은 주제), weak: 약한 연관, speculative: 추측적 연관

// 연결선 데이터
export interface EdgeData {
  id: string                  // 연결선 고유 ID
  fromNodeId: string          // 시작 카드 ID
  toNodeId: string            // 도착 카드 ID
  strength: EdgeStrength      // 연결 강도
  label?: string              // 연결선에 표시할 라벨 (선택)
  animated?: boolean          // 애니메이션 적용 여부
}

// --- 실시간 데이터 ---

// WebSocket 연결 상태 — 바이낸스 등 데이터 소스와의 연결 상태
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
// disconnected: 끊김, connecting: 연결 중, connected: 연결됨, reconnecting: 재접속 중

// 실시간 시세 데이터 — 바이낸스 WebSocket에서 받는 코인 가격 정보
export interface TickerData {
  symbol: string              // 코인 심볼 (예: 'BTCUSDT')
  price: number               // 현재 가격
  prevPrice: number           // 이전 가격 (가격 상승/하락 표시용)
  change24h: number           // 24시간 가격 변동률 (%)
  volume24h: number           // 24시간 거래량
  high24h: number             // 24시간 최고가
  low24h: number              // 24시간 최저가
  latency: number             // 데이터 지연 시간 (밀리초) — 얼마나 실시간에 가까운지
  lastUpdate: number          // 마지막 업데이트 시간 (타임스탬프)
  source: string              // 데이터 출처 (예: 'binance')
}

// --- Claude API 메시지 형식 ---

// API 응답의 콘텐츠 블록 — 텍스트, 도구 호출, 도구 결과 중 하나
export type ApiContentBlock =
  | { type: 'text'; text: string }                                                      // 텍스트 응답
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }     // AI가 도구 호출
  | { type: 'tool_result'; tool_use_id: string; content: string }                       // 도구 실행 결과

// Claude API 메시지 — 대화 기록의 한 턴
export interface ApiMessage {
  role: 'user' | 'assistant'                   // 발신자 (사용자 또는 AI)
  content: string | ApiContentBlock[]          // 메시지 내용 (단순 텍스트 또는 블록 배열)
}

// --- IPC(프로세스 간 통신) 페이로드/응답 ---

// Electron 메인 프로세스에 보내는 채팅 요청 데이터
export interface ChatPayload {
  apiKey: string              // Claude API 키
  model: string               // 사용할 AI 모델
  system: string              // 시스템 프롬프트
  messages: ApiMessage[]      // 대화 기록
  tools: unknown[]            // AI가 사용할 수 있는 도구 목록
}

// Electron 메인 프로세스에서 받는 채팅 응답 데이터
export interface ChatResponse {
  content: ApiContentBlock[]  // 응답 내용 (텍스트 + 도구 호출)
  stop_reason: string         // 응답 종료 이유
}

// --- 뉴스 피드 ---

// 뉴스 카테고리 — 뉴스의 분야를 나타냄
export type FeedCategory = 'macro' | 'crypto' | 'onchain' | 'exchange' | 'social' | 'stocks' | 'world'
// macro: 거시경제/규제, crypto: 암호화폐, onchain: 블록체인 데이터, exchange: 거래소
// social: 소셜미디어, stocks: 주식, world: 세계 이벤트

// 뉴스 중요도 — AI가 평가하는 뉴스의 영향력 수준
export type FeedImportance = 'critical' | 'alert' | 'signal' | 'info'
// critical: 시장 움직이는 사건, alert: 중요 주의, signal: 참고할 만한 신호, info: 일반 정보

// 뉴스 피드 아이템 — 하나의 뉴스 기사를 나타냄
export interface FeedItem {
  id: string                          // 뉴스 고유 ID
  title: string                       // 헤드라인 제목
  source: string                      // 뉴스 출처 (예: 'CoinDesk', 'Bloomberg')
  url: string                         // 원문 링크
  category: FeedCategory              // 뉴스 카테고리
  importance: FeedImportance          // 기본 중요도
  timestamp: number                   // 발행 시간 (타임스탬프)
  summary?: string                    // 뉴스 요약 (선택)
  location?: string                   // 관련 지역 (예: 'Washington DC', 'Seoul')
  aiImportance?: FeedImportance       // AI가 재평가한 중요도 (기본 중요도를 덮어씀)
  relevanceScore?: number             // AI가 매긴 관련성 점수 (0-100, 사용자 컨텍스트 기준)
  scored?: boolean                    // AI 스코어링 완료 여부
}
