# Current Task

## Status: Phase 3A COMPLETE ✅
**All Phase 1 + Phase 2 (2A–2D) + Phase 3A complete.**

---

## Phase 1 (COMPLETE ✅)
- [x] **Phase 1-1: Project Setup** — Electron + React + TypeScript + TailwindCSS + Vite
- [x] **Phase 1-2: Boot Sequence** — Cinematic startup animation
- [x] **Phase 1-3: Layout** — Canvas (pan/zoom) + ChatPanel (messages)
- [x] **Phase 1-4: Claude API Integration** — IPC bridge, tool definitions, multi-turn, Settings modal
- [x] **Phase 1-5: Card Rendering + Cinematic Spawn** — Markdown cards, drag/resize, spawn animation, tool execution
- [x] **Phase 1-6: Webview Rendering** — Embedded websites on canvas with drag/resize, reload, error fallback
- [x] **Phase 1-7: Real-Time Data** — Extensible DataSource architecture, Binance WebSocket, latency indicator, price flash, status bar
- [x] **Phase 1-8: Investigation Mode** — Full-screen 6-panel analysis grid, maximize/fold, scan line, ESC close

---

## Phase 2: Mosaic Intelligence Platform (COMPLETE ✅)

### Phase 2A: Foundation Enhancement ✅
- [x] **2A-1: Design System Migration** — New color palette, Rajdhani font, CSS variables, all components updated
- [x] **2A-2: Tab System** — COMMAND / FEED tabs with state preservation
- [x] **2A-3: Node-Edge Connections** — Hover-reveal SVG edges, pin/unpin, auto-edge from AI
- [x] **2A-4: Price Ticker Bar** — Bottom scrolling ticker with live crypto + traditional asset prices
- [x] **2A-5: Layout Update** — 3-panel COMMAND tab (News placeholder | Canvas | Chat)
- [x] **2A-6: AI Data Enhancement** — Tavily web search + real-time market data in system prompt

### Phase 2B: Breaking News Feed ✅
- [x] **2B-1: Feed Data Service** — CryptoCompare news + Fear & Greed Index, IPC handlers, feedService
- [x] **2B-2: Feed Store** — useFeedStore with addItems, filters, getFilteredItems
- [x] **2B-3: News Feed UI** — Left panel with live news, category/importance badges, drag-to-canvas
- [x] **2B-4: AI Relevance Scoring** — Batch scoring via Haiku, async update, ON/OFF toggle

### Phase 2C: FEED Tab ✅
- [x] **2C-1: FEED Tab Layout** — MosaicFeed with WorldMap/FeedSidebar top + expandable MultiColumnFeed bottom
- [x] **2C-2: World Map** — Dark world map with geo-tagged news pins, hover tooltips, pulse animation
- [x] **2C-3: Feed Sidebar** — Unified feed with category/importance filters and search
- [x] **2C-4: Multi-Column Raw Feed** — 7 category columns (MACRO/CRYPTO/ON-CHAIN/EXCHANGE/SOCIAL/STOCKS/WORLD)
- [x] **2C-5: Event Calendar** — Monthly calendar with FOMC, CPI, NFP dates + crypto events

### Phase 2D: Advanced Features ✅
- [~] **2D-1: Insight Pulse** — Skipped
- [x] **2D-2: Enhanced AI Chat** — SSE streaming + typing animation + focusedCard context linkage
- [x] **2D-3: Investigation Mode Upgrade** — Dynamic panels with real data (Chart/News/Whale/On-chain/Sector)
- [x] **2D-4: Additional Data Sources** — Binance Futures (funding/OI), Upbit Kimchi Premium, Investigation derivatives
- [x] **2D-5: Webview Content Recognition** — Live title/URL capture, auto-edges, [OPEN WEBVIEWS] AI context

---

## Phase 3A: AI Tool Arsenal + Perceived Speed (COMPLETE ✅)

- [x] **3A-1: Dynamic Symbol Resolution** — CoinGecko /search API, session cache, Korean name mapping
- [x] **3A-2: fetch_coin_data** — CoinGecko + Binance + optional Futures data
- [x] **3A-3: fetch_market_overview** — Global metrics + Fear & Greed + Top gainers/losers
- [x] **3A-4: fetch_derivatives_data** — Binance Futures 8 APIs (funding, OI, long/short, liquidations)
- [x] **3A-5: fetch_whale_activity** — Large trades + order book walls
- [x] **3A-6: fetch_trending** — CoinGecko trending coins/NFT/categories
- [x] **3A-7: spawn_multiple_cards** — Batch card+webview creation with grid layout + auto-edges
- [x] **3A-8: Skeleton Cards** — isLoading shimmer → content transition
- [x] **3A-9: SSE/Tool Timeout + Error Handling** — 60s SSE timeout, 30s tool timeout, retry logic
- [x] **3A-10: Sound Feedback** — Web Audio API (boot, card spawn, AI response)
- [x] **3A-11: API Retry + Stability** — fetchWithRetry (exponential backoff), empty catch fix, scoring parse fix
- [x] **3A-12: CCXT 6-Exchange** — Binance, Upbit, Bybit, Bithumb, OKX, Coinbase + 김치 프리미엄
- [x] **3A-13+14: CCXT Pro WebSocket** — 통합 실시간 시세/대형체결, lazy connection, 5min idle disconnect
- [x] **3A-15: CoinMarketCap API** — 보조 데이터 소스, Settings 키 관리, fetch_coin_data + fetch_market_overview 보강
- [x] **3A-16: Investigation Mode Dynamic Panels** — update_investigation 도구, 동적 패널 추가/제거/수정
- [x] **3A-17: Webview Control Tools** — control_webview (navigate/resize/tv_change_symbol/tv_change_interval)

---

## AI Tools (17)

### Display (7)
1. spawn_card — 정보 카드 생성
2. spawn_webview — 웹사이트 임베드
3. spawn_multiple_cards — 복수 카드+웹뷰 동시 생성
4. remove_cards — 카드 삭제
5. rearrange — 카드 재배치
6. update_card — 카드 내용 수정
7. control_webview — 웹뷰 조작 (URL/크기/TradingView)

### Data (8)
8. fetch_coin_data — 코인 종합 데이터
9. fetch_market_overview — 시장 전체 현황
10. fetch_derivatives_data — 선물 파생상품
11. fetch_whale_activity — 고래 거래 탐지
12. fetch_trending — 트렌딩 코인
13. fetch_exchange_price — 특정 거래소 가격
14. compare_exchange_prices — 멀티 거래소 비교 + 김치 프리미엄
15. search_web — Tavily 웹 검색

### Analysis (2)
16. open_investigation — Investigation Mode 열기
17. update_investigation — 패널 동적 관리

---

## Next: Phase 3B (개인화 + 기억 시스템)
대기 중. 우선순위 결정 후 시작.

## Known Issues
- (window as any).api 타입 캐스팅 4곳
- 카테고리 색상 정의 중복 4곳
- Card/WebviewCard 드래그 로직 중복
- console.log 디버그문 잔류
- anthropic-version 하드코딩 2곳
