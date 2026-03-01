// ============================================================
// Preload 스크립트 — 화면(렌더러)과 엔진(메인 프로세스) 사이의 보안 다리
// 역할: 화면(React)에서 직접 시스템에 접근하면 보안 위험이 있으므로,
//       허용된 기능만 window.api 객체를 통해 안전하게 노출합니다.
// 비유: 은행 창구 — 고객(화면)이 금고(엔진)에 직접 들어가지 못하고,
//       창구 직원(이 파일)을 통해서만 요청할 수 있음
// ============================================================

// contextBridge: 안전한 API 노출 도구 / ipcRenderer: 메인 프로세스에 메시지를 보내는 도구
import { contextBridge, ipcRenderer } from 'electron'

// window.api 라는 이름으로 화면에서 사용할 수 있는 함수들을 등록
contextBridge.exposeInMainWorld('api', {

  // ── Claude AI 채팅 (일반 방식: 전체 응답을 한 번에 받음) ──
  sendChatMessage: (payload: unknown) =>
    ipcRenderer.invoke('claude:chat', payload),

  // ── Claude AI 채팅 (스트리밍 방식: 실시간으로 글자가 하나씩 나옴) ──
  startChatStream: (payload: unknown) =>
    ipcRenderer.send('claude:chat-stream', payload),

  // 스트리밍 이벤트 수신기 — 메인 프로세스에서 보내는 실시간 데이터를 받음
  // 예: 'stream:text-delta' 채널로 AI가 쓰는 글자 조각이 들어옴
  // 반환값은 구독 해제 함수 (메모리 누수 방지)
  onStreamEvent: (channel: string, callback: (data: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data)
    ipcRenderer.on(channel, listener)
    return () => { ipcRenderer.removeListener(channel, listener) }
  },

  // ── 전통자산 시세 (S&P 500, 나스닥, 금, 원유, 달러인덱스) ──
  getTradFiQuotes: () =>
    ipcRenderer.invoke('tradfi:quotes'),

  // ── 웹 검색 (AI가 최신 정보를 찾을 때 사용) ──
  searchWeb: (query: string, apiKey: string) =>
    ipcRenderer.invoke('tavily:search', { query, apiKey }),

  // ── 암호화폐 뉴스 목록 ──
  fetchCryptoNews: () => ipcRenderer.invoke('feed:cryptonews'),

  // ── 공포&탐욕 지수 (시장 심리 지표) ──
  fetchFearGreed: () => ipcRenderer.invoke('feed:feargreed'),

  // ── 조사 모드(Investigation Mode)용 API들 ──

  // 바이낸스 최근 체결 거래 내역
  fetchRecentTrades: (symbol: string, limit: number) =>
    ipcRenderer.invoke('binance:trades', { symbol, limit }),

  // 여러 코인의 24시간 시세 요약 (가격/변동률/거래량)
  fetchMultipleTickers: (symbols: string[]) =>
    ipcRenderer.invoke('binance:multi-ticker', { symbols }),

  // CoinGecko 코인 상세 데이터 (시총, 공급량, ATH 등)
  fetchCoinData: (coinId: string) =>
    ipcRenderer.invoke('coingecko:coin-data', { coinId }),

  // 코인 심볼 → CoinGecko ID 변환 검색
  searchCoinId: (symbol: string) =>
    ipcRenderer.invoke('coingecko:search', { symbol }),

  // ── 바이낸스 선물(Futures) 데이터 ──

  // 펀딩비 조회 (롱/숏 세력 비율 지표)
  fetchFundingRate: (symbol: string) =>
    ipcRenderer.invoke('binance-futures:funding', { symbol }),

  // 미결제약정 조회 (현재 열려있는 선물 포지션 총 규모)
  fetchOpenInterest: (symbol: string) =>
    ipcRenderer.invoke('binance-futures:open-interest', { symbol }),

  // ── 업비트 김치 프리미엄 ──
  // 한국 거래소 vs 해외 거래소 가격 차이(%) 계산
  fetchKimchiPremium: (symbols: string[]) =>
    ipcRenderer.invoke('upbit:kimchi-premium', { symbols }),

  // ── AI fetch_coin_data 도구 (Phase 3) ──
  // 특정 코인의 종합 데이터 조회 (심볼/이름/한국어 검색 가능)
  queryCoinData: (query: string, includeFutures?: boolean) =>
    ipcRenderer.invoke('fetch-coin-data', query, includeFutures || false),

  // ── 심볼 동적 해석 (Phase 3) ──
  // CoinGecko /search API로 아무 코인이든 심볼/이름으로 찾기
  resolveSymbol: (query: string) =>
    ipcRenderer.invoke('resolve-symbol', query),
  resolveMultipleSymbols: (queries: string[]) =>
    ipcRenderer.invoke('resolve-multiple-symbols', queries),

  // ── AI fetch_market_overview 도구 (Phase 3) ──
  // 전체 크립토 시장 상황 종합 (글로벌 메트릭 + 공포탐욕 + Top 상승/하락)
  fetchMarketOverview: () =>
    ipcRenderer.invoke('fetch-market-overview'),

  // ── AI fetch_derivatives_data 도구 (Phase 3) ──
  // 선물/파생상품 종합 데이터 (펀딩비, OI, 롱숏, 테이커, 청산 등)
  fetchDerivativesData: (symbol: string) =>
    ipcRenderer.invoke('fetch-derivatives-data', symbol),

  // ── AI fetch_trending 도구 (Phase 3) ──
  // 트렌딩 코인, NFT, 카테고리
  fetchTrending: () =>
    ipcRenderer.invoke('fetch-trending'),

  // ── AI fetch_whale_activity 도구 (Phase 3) ──
  // 대형 거래(고래 활동) 탐지 (최근 거래 + 호가벽)
  fetchWhaleActivity: (symbol?: string) =>
    ipcRenderer.invoke('fetch-whale-activity', symbol),

  // ── CoinMarketCap 보조 데이터 (Phase 3A-5) ──

  // CMC 코인 상세 데이터
  cmcCoinData: (apiKey: string, symbol: string) =>
    ipcRenderer.invoke('cmc-coin-data', apiKey, symbol),

  // CMC 글로벌 메트릭
  cmcGlobalMetrics: (apiKey: string) =>
    ipcRenderer.invoke('cmc-global-metrics', apiKey),

  // CMC 카테고리별 코인
  cmcCategories: (apiKey: string) =>
    ipcRenderer.invoke('cmc-categories', apiKey),

  // CMC 최근 신규 상장
  cmcLatestListings: (apiKey: string) =>
    ipcRenderer.invoke('cmc-latest-listings', apiKey),

  // ── CCXT 멀티 거래소 통합 (Phase 3A-4) ──

  // 특정 거래소의 현재가 조회
  exchangeFetchTicker: (exchangeId: string, symbol: string) =>
    ipcRenderer.invoke('exchange-fetch-ticker', exchangeId, symbol),

  // 여러 거래소에서 동시 가격 비교
  exchangeComparePrices: (exchangeIds: string[], symbol: string) =>
    ipcRenderer.invoke('exchange-compare-prices', exchangeIds, symbol),

  // 김치 프리미엄 계산 (USDT/KRW 환율 기반)
  exchangeKimchiPremium: (symbol?: string) =>
    ipcRenderer.invoke('exchange-kimchi-premium', symbol),

  // 특정 거래소의 오더북 조회
  exchangeOrderbook: (exchangeId: string, symbol: string, limit?: number) =>
    ipcRenderer.invoke('exchange-orderbook', exchangeId, symbol, limit),

  // 지원 거래소 목록 반환
  exchangeList: () =>
    ipcRenderer.invoke('exchange-list'),

  // ── CCXT Pro WebSocket 실시간 데이터 (Phase 3A-6) ──

  // 실시간 시세 구독 시작
  exchangeWsWatchTicker: (exchangeId: string, symbol: string) =>
    ipcRenderer.invoke('exchange-ws-watch-ticker', exchangeId, symbol),

  // 실시간 대형 체결 구독 시작
  exchangeWsWatchTrades: (exchangeId: string, symbol: string, minAmountUSDT?: number) =>
    ipcRenderer.invoke('exchange-ws-watch-trades', exchangeId, symbol, minAmountUSDT),

  // 특정 구독 해제
  exchangeWsUnwatch: (exchangeId: string, symbol: string, type: 'ticker' | 'trades') =>
    ipcRenderer.invoke('exchange-ws-unwatch', exchangeId, symbol, type),

  // 전체 구독 해제
  exchangeWsUnwatchAll: () =>
    ipcRenderer.invoke('exchange-ws-unwatch-all'),

  // 활성 와처 목록 조회
  exchangeWsGetActive: () =>
    ipcRenderer.invoke('exchange-ws-active'),

  // 실시간 시세 업데이트 수신 리스너
  onExchangeTickerUpdate: (callback: (data: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data)
    ipcRenderer.on('exchange-ticker-update', listener)
    return () => { ipcRenderer.removeListener('exchange-ticker-update', listener) }
  },

  // 실시간 대형 체결 수신 리스너
  onExchangeLargeTrade: (callback: (data: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data)
    ipcRenderer.on('exchange-large-trade', listener)
    return () => { ipcRenderer.removeListener('exchange-large-trade', listener) }
  },
})
