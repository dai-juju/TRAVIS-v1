# TRAVIS — Shape Your Market
# AI-Powered System Optimizing the Traders' Killchain

## What is this
TRAVIS is an AI-powered trading intelligence environment.
User types natural language in chat → Claude AI decides what to show → spawns info cards and websites on an infinite canvas with cinematic animations.
Like JARVIS for traders, powered by Mosaic Theory.

**Internal framework — Killchain**: DETECT → COLLECT → JUDGE → EXECUTE
(This killchain concept drives internal architecture decisions. Externally we say "Optimizing the Entire Trading Process".)

## Core Philosophy: Mosaic Theory
Individual public information tiles, when connected, reveal non-obvious insights.
- AI does NOT filter data — AI scores relevance + highlights importance
- Raw Feed is the default. Traders must see everything, not just what AI thinks matters.
- "The tile AI skipped might be the one that makes you rich."

## Tech Stack
- Electron (app shell + webview for embedded sites)
- React + TypeScript (frontend)
- TailwindCSS (styling)
- Zustand (state management)
- Claude API with tool use (AI brain) — Sonnet for main chat, Haiku for scoring/translation
- Vite (bundler)
- CCXT (6 exchanges: Binance, Upbit, Bybit, Bithumb, OKX, Coinbase)
- CCXT Pro WebSocket (real-time multi-exchange ticker/trades)
- WebSocket (Binance Spot real-time price/volume streams)
- CoinGecko + CoinMarketCap (market data)
- Tavily (web search)
- Web Audio API (sound feedback)
- Framer Motion (animations)

## Design System
```
Colors:
  --void:   #01010a    (background deepest)
  --deep:   #030310    (panel background)
  --panel:  #06060f
  --card:   #0a0a18    (card background)
  --border: rgba(255,255,255,0.05)
  --pb:     #a855f7    (main purple)
  --purple: #7c3aed
  --cyan:   #22d3ee    (on-chain / accent)
  --green:  #22c55e    (up / complete)
  --red:    #ef4444    (down / danger)
  --amber:  #f59e0b    (macro / warning)
  --blue:   #3b82f6    (stocks)
  --pink:   #ec4899    (world)

Category Colors:
  MACRO    → amber (#f59e0b)
  CRYPTO   → purple (#a855f7)
  ON-CHAIN → cyan (#22d3ee)
  EXCHANGE → red (#ef4444)
  SOCIAL   → green (#22c55e)
  STOCKS   → blue (#3b82f6)
  WORLD    → pink (#ec4899)

Fonts:
  JetBrains Mono → all data/numbers/UI
  Rajdhani → headers/titles (military feel)

Importance Levels:
  HIGH → bright text + subtle bg + border
  MED  → medium text + faint bg
  LOW  → dim text (opacity 0.5) + no border
```

## Project Structure
```
src/
  main/                          → Electron main process
    index.ts                     → App entry point, window creation
    ipc.ts                       → IPC handler registration (25+ handlers)
    preload.ts                   → Secure contextBridge (25+ methods)
    tavily.ts                    → Tavily web search API handler
    binanceApi.ts                → Binance REST (trades, multi-ticker)
    binanceFuturesApi.ts         → Binance Futures (funding, OI)
    coingeckoApi.ts              → CoinGecko (coin data, search)
    upbitApi.ts                  → Upbit Kimchi Premium
    yahooFinance.ts              → Traditional asset quotes
    feedApi.ts                   → CryptoCompare news, Fear & Greed
    api/                         → Phase 3A API modules
      coinDataApi.ts             → CoinGecko + Binance 코인 종합 데이터
      marketOverviewApi.ts       → 시장 전체 현황 (글로벌 메트릭 + F&G)
      derivativesApi.ts          → 선물 파생상품 (8개 Binance Futures API)
      whaleApi.ts                → 고래 거래 탐지 (대형 체결 + 호가벽)
      trendingApi.ts             → 트렌딩 코인 (CoinGecko)
      symbolResolverApi.ts       → 동적 심볼 해석 (CoinGecko /search)
      exchangeService.ts         → CCXT 6거래소 통합 서비스
      cmcApi.ts                  → CoinMarketCap API (보조 데이터)
      utils/
        fetchWithRetry.ts        → API 재시도 유틸 (exponential backoff)
    services/
      exchangeWsService.ts       → CCXT Pro WebSocket (실시간 멀티거래소)
  renderer/                      → React frontend
    App.tsx                      → Root layout: Boot → TabSystem → Content
    components/
      BootSequence.tsx           → Cinematic startup animation
      Canvas.tsx                 → Infinite pan/zoom canvas
      ChatPanel.tsx              → AI chat with streaming + focus context
      Card.tsx                   → Info card (markdown, images, price flash)
      WebviewCard.tsx            → Embedded website with metadata capture + webviewRefs
      InvestigationMode.tsx      → Dynamic panel grid (AI-controlled)
      InvestigationPanel.tsx     → Panel router (chart/whale/onchain/sector/markdown)
      InvestigationChart.tsx     → TradingView chart panel
      InvestigationWhale.tsx     → Large trades table
      InvestigationOnchain.tsx   → CoinGecko market data
      InvestigationSector.tsx    → Sector comparison table
      InvestigationNews.tsx      → Symbol-filtered news
      SpawnAnimation.tsx         → Card spawn effects
      TabBar.tsx                 → COMMAND / FEED tabs
      NewsFeed.tsx               → Left-side breaking news
      FeedItem.tsx               → Single feed item component
      MosaicFeed.tsx             → FEED tab layout
      MultiColumnFeed.tsx        → 7-column raw feed view
      FeedSidebar.tsx            → Feed sidebar with filters
      FeedColumn.tsx             → Single category feed column
      WorldMap.tsx               → World map with event pins
      EventCalendar.tsx          → Economic/crypto event calendar
      EdgeLayer.tsx              → SVG edge layer
      NodeEdge.tsx               → Connection lines between cards
      PriceTicker.tsx            → Bottom scrolling ticker + KimPre
      StatusBar.tsx              → Connection status
      LatencyIndicator.tsx       → Real-time data delay indicator
      SettingsModal.tsx          → API keys + model config + CMC key
    stores/
      useCanvasStore.ts          → Cards, edges, viewport, webview meta/URL
      useChatStore.ts            → Messages, streaming, focused card
      useSettingsStore.ts        → API keys (Claude, Tavily, CMC), model, context
      useRealtimeStore.ts        → WebSocket state, live tickers
      useInvestigationStore.ts   → Investigation panels, dynamic management
      useTabStore.ts             → Active tab state
      useFeedStore.ts            → News items, filters, categories
    services/
      claude.ts                  → Claude API, 17 tools, streaming, system prompt
      dataSource.ts              → DataSource interface + manager
      binanceWs.ts               → Binance WebSocket implementation
      feedService.ts             → News aggregation + geo-tagging
      scoringService.ts          → AI relevance scoring (Haiku)
      soundService.ts            → Sound feedback (Web Audio API)
    types/
      index.ts                   → Shared TypeScript types
    utils/
      geoKeywords.ts             → Location extraction for world map
docs/
  spec.md                        → Feature specification
  plan.md                        → Development plan (phased)
  current-task.md                → Current task status
```

## Core Architecture Flow
1. App opens → Boot sequence animation plays
2. User sees COMMAND tab (News Feed | Canvas | Chat)
3. User types in ChatPanel → claude.ts sends to Claude API
4. Claude responds with tool_use calls → executeTool() processes them
5. Data tools (fetch_coin_data, etc.) call main process APIs via IPC bridge
6. Display tools (spawn_card, spawn_webview) update useCanvasStore
7. SpawnAnimation plays → skeleton card → content fill transition
8. Edges between related nodes (hidden by default, revealed on hover)
9. binanceWs.ts subscribes to symbols → real-time price updates
10. Breaking news flows into left-side NewsFeed panel (CryptoCompare + AI scoring)
11. User can drag news items onto canvas to create new nodes
12. Double-click card → Investigation Mode with dynamic AI-controlled panels

## Claude API Tools (17 tools)

### Display Tools
- spawn_card(title, content, cardType?, symbol?, images?, relatedTo?) → Create info card
- spawn_webview(url, title, width?, height?) → Embed website on canvas
- spawn_multiple_cards(cards[], webviews?[]) → Batch create cards + webviews with grid layout
- remove_cards(target) → Remove cards ("all" or card ID)
- rearrange(layout) → Rearrange cards ("grid" / "stack")
- update_card(cardId, content) → Update existing card content
- control_webview(webviewId, action, url?, symbol?, interval?, width?, height?) → Navigate/resize/TradingView control

### Data Tools
- fetch_coin_data(query, include_futures?) → 코인 종합 데이터 (CoinGecko + Binance + CMC)
- fetch_market_overview() → 시장 전체 현황 (글로벌 메트릭 + F&G + Top 상승/하락)
- fetch_derivatives_data(symbol) → 선물 데이터 (펀딩비, OI, 롱숏, 청산)
- fetch_whale_activity(symbol?) → 고래 거래 (대형 체결 + 호가벽)
- fetch_trending() → 트렌딩 코인/NFT/카테고리
- fetch_exchange_price(exchange, symbol) → 특정 거래소 가격 (CCXT 6거래소)
- compare_exchange_prices(symbol, mode?, exchanges?) → 멀티 거래소 비교 + 김치 프리미엄
- search_web(query) → Tavily 웹 검색

### Analysis Tools
- open_investigation(cardId) → Investigation Mode 열기
- update_investigation(action, panelId?, panel?, panelIds?) → 패널 동적 관리

## Development Rules
- Read docs/plan.md FIRST before writing any code
- Implement ONE phase at a time
- Follow the project structure above when creating files
- When modifying existing code, explain impact scope first
- Include error messages when reporting issues
- Write code in English, comments can be Korean
- Test each phase before moving to the next
- Apply Design System colors/fonts when creating new UI components

## Commands
- npm run dev → Start dev server (Electron + Vite)
- npm run build → Production build

## Current Task
Read docs/current-task.md for current status.

---

## Architecture Rules

### AI Tool Addition Pattern (5-step)
AI 도구를 추가할 때 반드시 이 5단계 패턴을 따른다:

1. `src/main/api/[name]Api.ts` — 실제 API 호출 로직 (새 파일 또는 기존 파일)
2. `src/main/ipc.ts` — IPC handler 등록 (handle/on)
3. `src/main/preload.ts` — contextBridge에 메서드 노출
4. `src/renderer/services/claude.ts` — TOOLS 배열에 도구 정의 추가
5. `src/renderer/services/claude.ts` — executeTool() 함수에 case 추가

이 5개 파일을 모두 수정해야 도구가 동작한다. 하나라도 빠지면 안 된다.

### Design Philosophy
- **하드코딩 금지**: AI 행동을 코드에서 분기하지 않는다. AI에게 도구를 주고, 시스템 프롬프트에 원칙만 적는다.
- **동적 심볼 해석**: CoinGecko /search API로 아무 코인이든 자동 resolve. KNOWN_SYMBOLS 하드코딩 없음.
- **독립적 실패**: 모든 데이터 fetch는 Promise.allSettled 패턴. 하나 실패해도 나머지는 표시.
- **Fire Hose 원칙**: 도구는 모든 데이터를 반환, AI가 필터링/요약.
- **비용 의식**: 뉴스 스코어링, 번역 등은 Haiku 모델. 메인 대화만 Sonnet.
- **유저 통제권**: AI가 제안하지만, 카드 삭제/이동/수정은 유저가 자유롭게.

### Data Source Architecture
- **fetchWithRetry**: CoinGecko API에 적용 (exponential backoff, 3회 재시도). Binance는 미적용 (rate limit 관대).
- **CCXT**: 6거래소 통합 (binance, upbit, bybit, bithumb, okx, coinbase). REST + WebSocket.
- **CMC**: 보조 소스. API 키 선택적. 실패해도 기존 CoinGecko 데이터에 영향 없음.
- **Sound**: soundService.ts, Web Audio API 기반. 부팅/카드스폰/AI응답 사운드.
- **Skeleton Cards**: 카드 생성 시 즉시 스켈레톤 표시 → 데이터 도착 후 콘텐츠 전환.

### System Prompt Philosophy
시스템 프롬프트에 하드코딩된 Analysis Protocol을 절대 넣지 않는다.
대신 원칙만 적는다:
1. 데이터 우선: 실시간 데이터를 먼저 조회한 후 답변. 추측 금지.
2. 유저 맞춤: [USER PROFILE] 참고하여 맞춤 정보 제공.
3. 충분한 맥락: 분석 시 복수 데이터 소스 활용.
4. 자기 한계 인지: 불확실한 정보는 명시.
5. 효율성: 단순 질문에는 단순 답변.

### Technical Debt
- (window as any).api 캐스팅 4곳 → 타입 정의로 교체
- 카테고리 색상 정의 중복 4곳 → constants.ts로 통합
- Card/WebviewCard 드래그 로직 중복 → 공통 훅으로 추출
- console.log 디버그문 → 제거 또는 조건부 로깅
- anthropic-version 하드코딩 2곳 → 상수로 통합
