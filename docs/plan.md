# TRAVIS — Development Plan v3

---

# PHASE 1 (COMPLETE ✅)

## Phase 1-1: Project Setup ✅
## Phase 1-2: Boot Sequence ✅
## Phase 1-3: Layout (Canvas + Chat Panel) ✅
## Phase 1-4: Claude API Integration ✅
## Phase 1-5: Card Rendering + Cinematic Spawn ✅
## Phase 1-6: Webview Rendering ✅
## Phase 1-7: Real-Time Data (WebSocket) ✅
## Phase 1-8: Investigation Mode ✅

---

# PHASE 2: MOSAIC INTELLIGENCE PLATFORM

## Overview
Transform TRAVIS from "chat → cards" into a full Mosaic Intelligence Platform.
Phase 2 is split into 4 sub-phases (2A → 2B → 2C → 2D). Complete in order.

---

## Phase 2A: Foundation Enhancement
**Goal**: Upgrade existing app with tab system, new design system, hover-reveal node edges, and price ticker.

### 2A-1: Design System Migration
- [ ] Add Rajdhani font (Google Fonts CDN) for headers/titles
- [ ] Update CSS variables with new color palette from CLAUDE.md Design System
- [ ] Update all existing components to use new colors:
  - void (#01010a) for deepest backgrounds
  - deep (#030310) for panel backgrounds
  - card (#0a0a18) for card backgrounds
  - Update border colors to rgba(255,255,255,0.05)
- [ ] Update text colors: t1 (#f1f5f9), t2 (#94a3b8), t3 (#475569), t4 (#1e293b)
- [ ] Update boot sequence to use new design system
- [ ] Verify: All existing UI reflects new color/font scheme

### 2A-2: Tab System
- [ ] Create src/renderer/stores/useTabStore.ts — activeTab: 'command' | 'feed'
- [ ] Create src/renderer/components/TabBar.tsx
  - Two tabs: "◈ COMMAND" / "◈ FEED"
  - Active tab: purple underline + subtle glow
  - Position: top of app, below Electron title bar
  - Dark background matching --deep color
- [ ] Update App.tsx: Boot → TabBar + conditional content rendering
  - Tab 'command' → existing Canvas + ChatPanel layout
  - Tab 'feed' → placeholder "FEED coming soon"
  - Tab switch preserves state (no remount)
- [ ] Verify: Can switch tabs, COMMAND tab works exactly as before

### 2A-3: Node-Edge Connections (Hover-Reveal)
- [ ] Update useCanvasStore.ts: add edges[] array and edge CRUD methods
  - addEdge(from, to, strength, label?)
  - removeEdge(id)
  - Edge type: { id, fromNodeId, toNodeId, strength, label?, animated }
  - hoveredNodeId: string | null
  - pinnedNodeIds: Set<string>
- [ ] Create src/renderer/components/NodeEdge.tsx
  - SVG lines/paths between node centers
  - **Hidden by default** (opacity 0)
  - **Hover on node**: fade in that node's direct edges (opacity 0.6, 0.2s transition)
  - **Click on node**: pin edges visible
  - **Shift+Click**: show 2nd-degree edges
  - **Click empty canvas**: un-pin all
  - Line styles: strong(solid 2px), weak(thin 1px), speculative(dotted 1px)
  - Colors: match source node category color
  - Optional: animated particles along edge (subtle, slow)
  - Lines update position when nodes are dragged
- [ ] Canvas.tsx: render edges as SVG layer beneath cards
  - Add global toggle button to show/hide ALL edges
- [ ] Update claude.ts: when AI spawns multiple related cards, auto-create edges
  - Add optional `relatedTo?: string[]` field to spawn_card tool
  - After spawning, create edges between related cards
- [ ] Verify: Hover on card → its edges appear. Click elsewhere → edges hide. Clean canvas by default.

### 2A-4: Price Ticker Bar
- [ ] Create src/renderer/components/PriceTicker.tsx
  - Fixed bar at bottom of app (below StatusBar)
  - Infinite horizontal scroll (CSS animation, right-to-left)
  - Items: BTC, ETH, SOL, BNB, XRP + S&P 500, NASDAQ, DXY, GOLD, OIL
  - Each: SYMBOL $price ▲/▼change%
  - Green for up, Red for down
  - Click item → useCanvasStore.addCard() with that symbol
- [ ] Subscribe crypto tickers to Binance WebSocket (reuse existing DataSource)
- [ ] Traditional assets: free REST API polling (Yahoo Finance proxy or similar)
  - Poll every 60 seconds
  - If API unavailable, show last known price with gray indicator
- [ ] Update App.tsx layout: add PriceTicker below StatusBar
- [ ] Verify: Scrolling ticker with live prices, click creates card

### 2A-5: Layout Update for COMMAND Tab
- [ ] Restructure COMMAND tab layout to 3-panel:
  - Left: placeholder panel (220px, for News Feed in 2B)
  - Center: existing Canvas
  - Right: existing ChatPanel (264px)
- [ ] Left panel shows "Breaking News Feed — coming soon" placeholder
- [ ] Verify: 3-panel layout works, canvas still functional

### 2A-6: AI Data Enhancement (Tavily + Real-Time Context)
- [ ] Add Tavily web search as a new Claude tool
  - Tool name: search_web
  - Input: { query: string }
  - Implementation: Main process에서 Tavily API 호출 (API key를 Settings에 추가)
  - Claude가 필요할 때 자율적으로 검색 가능
- [ ] Add Tavily API key input to SettingsModal.tsx (기존 Claude API key 아래)
- [ ] Create src/main/tavily.ts — Tavily API 호출 로직
- [ ] Add IPC handler for Tavily search in ipc.ts
- [ ] Inject real-time market data into system prompt automatically
  - When user message contains a coin symbol → Binance REST API로 현재 시세 가져오기
  - 가격, 24h 변동률, 거래량을 [REAL-TIME MARKET DATA] 섹션으로 시스템 프롬프트에 주입
- [ ] Update claude.ts:
  - search_web tool definition 추가 (7번째 도구)
  - System prompt에 [REAL-TIME MARKET DATA] 섹션 추가
  - search_web tool result 처리 (multi-turn)
- [ ] Verify: "BTC 분석해줘" → AI가 실시간 가격 기반으로 분석 + 필요시 웹 검색

**Done when**: New design applied, tabs work, hover-reveal edges, price ticker scrolls, AI has web search + real-time data.

---

## Phase 2B: Breaking News Feed + Free Data Sources ✅
**Goal**: Left panel shows live breaking news from free sources. Drag news to canvas.

### 2B-1: Feed Data Service
- [x] Create src/renderer/services/feedService.ts
  - FeedSource interface (like DataSource but for news/events)
  - CryptoPanic integration (free tier: crypto news aggregation)
    - API: https://cryptopanic.com/api/v1/posts/?auth_token=FREE
    - Parse: title, source, url, kind (news/media), published_at
  - CoinGecko integration (market data, free tier)
  - CoinMarketCap / CMC integration (free tier)
  - Fear & Greed Index (Alternative.me, free)
  - Exchange announcements (Binance, OKX, Bybit, Upbit — RSS/free endpoints)
  - DeFiLlama (TVL data, free)
  - Poll-based: fetch every 30-60 seconds
  - Normalize all sources into common FeedItem format
- [ ] Create src/renderer/types/ additions:
  - FeedItem: { id, title, source, url, category, importance, timestamp, summary?, location? }
  - FeedCategory: 'macro' | 'crypto' | 'onchain' | 'exchange' | 'social' | 'stocks' | 'world'
  - FeedImportance: 'critical' | 'alert' | 'signal' | 'info'

### 2B-2: Feed Store
- [x] Create src/renderer/stores/useFeedStore.ts
  - items: FeedItem[] (sorted by timestamp, newest first)
  - addItem(item) — prepend to list, cap at 200 items
  - filters: { categories: Set, importance: Set }
  - toggleFilter(category/importance)
  - Connection status per source

### 2B-3: News Feed UI (Left Panel)
- [x] Create src/renderer/components/NewsFeed.tsx
  - Replace left placeholder with live news feed
  - Header: "LIVE FEED" + connection indicator
  - Scrollable list of FeedItem components
  - New items slide in at top with animation
  - Auto-scroll, pause on hover
- [x] Create src/renderer/components/FeedItem.tsx
  - Left edge: category color strip (amber/purple/cyan/red/green/blue/pink)
  - Importance badge: CRITICAL(red bg) / ALERT(yellow) / SIGNAL(purple) / INFO(gray)
  - Title text (importance affects brightness/size)
  - Source + timestamp
  - Click → detail modal with full content
  - **Draggable**: drag item → drop on canvas → creates new card node
- [x] Implement drag-to-canvas:
  - onDragStart on FeedItem
  - onDrop on Canvas → useCanvasStore.addCard() from feed item data
  - AI auto-analyzes and suggests edges to existing nodes
- [x] Verify: Live news appears, can drag onto canvas, importance levels visible

### 2B-4: AI Relevance Scoring
- [x] When new feed items arrive, batch-send to Claude for relevance scoring
  - Claude scores 0-100 relevance to user's context prompt
  - Score displayed as subtle bar on each feed item
  - AI does NOT filter — only scores. All items remain visible.
  - Scoring is async (items appear immediately, score fills in later)
- [x] Verify: Feed items show relevance scores after brief delay

**Done when**: Left panel shows live news, drag-to-canvas works, AI scores relevance.

---

## Phase 2C: FEED Tab (World Map + Multi-Column Feed + Calendar) ✅
**Goal**: Second tab with world map, 7-column raw feed, and event calendar.

### 2C-1: FEED Tab Layout ✅
- [x] Create src/renderer/components/MosaicFeed.tsx
  - Top section: WorldMap (left) + FeedSidebar (right, 300px)
  - Bottom section: expandable multi-column view
  - Drag handle between top/bottom to expand columns view
- [x] Update TabBar: clicking "FEED" shows MosaicFeed component
- [x] Verify: Tab switching works, basic layout renders

### 2C-2: World Map ✅
- [x] Install react-simple-maps (lightweight world map library)
- [x] Create src/renderer/components/WorldMap.tsx
  - Dark theme world map (gray landmass on void background)
  - Event pins at locations from feed items (where location data available)
  - Pin colors: match feed level (critical=red, alert=yellow, signal=purple, info=gray)
  - Ping/pulse animation on new events
  - Hover pin → tooltip (title + time + source)
  - Click pin → detail modal + "Add to COMMAND" button
- [x] Create src/renderer/utils/geoKeywords.ts — keyword→coordinate mapping + location extraction
- [x] Update feedService.ts — auto-tag news items with location
- [x] Verify: Map renders, pins appear for geolocated feed items

### 2C-3: Feed Sidebar ✅
- [x] Create feed sidebar for FEED tab (right, 300px)
  - Unified feed (all categories mixed, sorted by time)
  - Filter toggles per category (7 toggles matching 7 columns)
  - Search bar (filter by keyword)
  - Reuse FeedItem component from 2B
  - Click item → modal + "Add to COMMAND" button
- [x] Verify: Sidebar shows all feeds, filters work

### 2C-4: Multi-Column Raw Feed ✅
- [x] Create src/renderer/components/FeedColumn.tsx
  - Single column: header (category name + color) + scrollable items
  - Each column independently scrolls
  - Items styled by importance level (HIGH/MED/LOW brightness)
- [x] Bottom panel of MosaicFeed: **7 columns** side by side
  - MACRO | CRYPTO | ON-CHAIN | EXCHANGE | SOCIAL | STOCKS | WORLD
  - Expandable: drag handle to pull up, slide-up animation
  - Each column receives items from useFeedStore filtered by category
- [x] Verify: 7 columns visible, each with relevant category items

### 2C-5: Event Calendar ✅
- [x] Create src/renderer/components/EventCalendar.tsx
  - Monthly calendar grid view
  - Events marked on dates with category color dots
  - Event types: FOMC, CPI, NFP, crypto events
  - Click date → list of events for that day
  - [MAP | CALENDAR] mini tabs in MosaicFeed top-left area
- [x] Data sources:
  - FOMC/CPI/NFP schedule (hardcoded 2025-2026)
  - Crypto milestone dates
- [x] Verify: Calendar renders, events visible, clickable

**Done when**: FEED tab fully functional with map, 7 feed columns, and calendar. ✅

---

## Phase 2D: Advanced Features ✅
**Goal**: Insight Pulse, enhanced AI, Investigation Mode upgrade, more data sources.

### 2D-1: Insight Pulse (Cross-Analysis Alerts) — SKIPPED
- [ ] AI automatically analyzes relationships between canvas nodes
- [ ] When pattern detected: glowing 💡 chip appears on relevant nodes
- [ ] Click chip → popup with:
  - Pattern description
  - Historical pattern matching
  - Risk factors
  - Confidence score (0-100%)
- [ ] Triggers: new node added, price significant change, new critical news
- [ ] Verify: Multi-node pattern detected and displayed

### 2D-2: Enhanced AI Chat ✅
- [x] SSE streaming with typing animation (character-by-character via main process proxy)
- [x] focusedCard context linkage:
  - Click card content → activates as chat context (purple border + context bar)
  - Subsequent messages include [FOCUSED CARD CONTEXT] in system prompt
  - Click ✕ or empty canvas → clears focus
- [x] Loading experience: pulsing "Analyzing..." indicator before streaming starts
- [x] Verify: Streaming works, card click → context bar, messages reference card content

### 2D-3: Investigation Mode Upgrade ✅
- [x] Binance REST API (klines, trades, multi-ticker) via binanceApi.ts
- [x] CoinGecko API (coin market data) via coingeckoApi.ts
- [x] 4 IPC handlers + preload methods for data fetching
- [x] PanelState extended with panelType, isLoading, error, data fields
- [x] loadPanelData(): parallel fetch for chart/whale/onchain/sector
- [x] InvestigationChart: lightweight-charts v5 candlestick chart (dark theme)
- [x] InvestigationNews: filtered news from useFeedStore by symbol
- [x] InvestigationWhale: large trades table ($100K+ threshold)
- [x] InvestigationOnchain: CoinGecko market/price/performance data
- [x] InvestigationSector: sector comparison table with current coin highlight
- [x] InvestigationPanel: panelType routing, loading spinner, error display
- [x] Each panel fails independently (Promise.allSettled)
- [ ] Panel drag-to-reposition within grid (deferred)
- [ ] Pop-out button (panel → floating overlay) (deferred)
- [x] Verify: All 6 panels have real dynamic data

### 2D-4: Additional Data Sources ✅
- [x] Binance Futures REST API (funding rate, open interest)
- [x] Upbit Kimchi Premium (BTC/ETH/XRP/SOL/DOGE/ADA)
- [x] IPC handlers + preload methods for new data sources
- [x] Investigation Mode: Derivatives section in overview panel
- [x] PriceTicker: KimchiIndicator between crypto and TradFi items
- [x] Verify: Futures data in Investigation, KimPre in ticker

### 2D-5: Webview Content Recognition ✅
- [x] Capture webview metadata (title, URL) via did-stop-loading/did-navigate-in-page/page-title-updated
- [x] WebviewData extended with liveTitle/liveUrl
- [x] updateWebviewMeta() in useCanvasStore
- [x] Auto-create speculative edges between webview and related canvas nodes
- [x] [OPEN WEBVIEWS] section in Claude system prompt
- [x] ChatPanel passes liveTitle/liveUrl to sendMessage

**Done when**: ~~Insight Pulse works~~(skipped), AI chat enhanced ✅, Investigation panels filled ✅, multiple data sources ✅, webview content recognized ✅.

---

## Phase 2 Success Criteria

1. App opens → boot → COMMAND tab with 3-panel layout
2. Left panel shows live breaking news (CryptoPanic + Fear&Greed + exchange announcements)
3. Price ticker scrolls at bottom with live prices
4. User types "BTC 분석해줘" → cards spawn, hover reveals connection edges
5. User drags a news item from feed onto canvas → new node with auto-edges
6. User switches to FEED tab → world map with event pins
7. User expands bottom panel → 7 columns of categorized raw feed
8. User clicks calendar → sees upcoming FOMC, token unlocks
9. Back to COMMAND → 💡 Insight Pulse chip appears on BTC node
10. User clicks chip → sees cross-analysis pattern with confidence score
11. User double-clicks node → Investigation Mode with all 6 panels populated
12. AI chat shows typing animation, clicking nodes triggers AI analysis

---

# PHASE 3: AI TOOL ARSENAL + PERSONALIZATION

## Overview
Phase 3 transforms TRAVIS from "chatbot trapped in training data" into "JARVIS that queries real data and adapts to each user."
Core philosophy: Give AI sufficient tools + principles only. No hardcoded procedures.
Phase 3 is split into 2 sub-phases (3A → 3B). Complete in order.
**Phase 3A: COMPLETE ✅** — Phase 3B: pending.

---

## Phase 3A: AI Tool Arsenal + Perceived Speed Revolution ✅
**Goal**: AI queries real data instead of guessing. Any coin supported. Multi-card spawning in one call. Perceived speed ×2.

### 3A-1: Dynamic Symbol Resolution ✅
- [x] CoinGecko /search API for auto-resolving any coin (symbol, name, Korean name)
- [x] Session cache (Map) + Korean coin name mapping
- [x] Removed KNOWN_SYMBOLS/SYMBOL_REGEX hardcoding

### 3A-2: fetch_coin_data Tool ✅
- [x] CoinGecko + Binance 종합 데이터 (coinDataApi.ts)
- [x] Dynamic symbol resolution + optional futures data
- [x] 5-step pattern: API → IPC → preload → TOOLS → executeTool

### 3A-3: fetch_market_overview Tool ✅
- [x] CoinGecko /global + Alternative.me F&G + Top gainers/losers (marketOverviewApi.ts)

### 3A-4: fetch_derivatives_data Tool ✅ (renamed from fetch_funding_rates)
- [x] Binance Futures 8개 API (derivativesApi.ts)
- [x] Funding rate, OI, global L/S, top trader L/S, taker B/S, OI history, liquidations

### 3A-5: fetch_whale_activity Tool ✅
- [x] Large trades + order book walls (whaleApi.ts)

### 3A-6: fetch_trending Tool ✅
- [x] CoinGecko /search/trending (trendingApi.ts)

### 3A-7: spawn_multiple_cards Tool ✅
- [x] Batch card + webview creation with grid layout + auto-edges

### 3A-8: Skeleton Cards ✅
- [x] isLoading shimmer → content transition (integrated into Card.tsx)

### 3A-9: SSE/Tool Timeout + Error Handling ✅
- [x] SSE 60s timeout, Tool 30s timeout
- [x] fetchWithRetry (exponential backoff for CoinGecko)

### 3A-10: Sound Feedback ✅
- [x] Web Audio API (soundService.ts) — boot, card spawn, AI response

### 3A-11: API Retry + Stability ✅
- [x] fetchWithRetry, empty catch fix, scoring parse fix, tool loop review

### 3A-12: CCXT 6-Exchange Integration ✅
- [x] Binance, Upbit, Bybit, Bithumb, OKX, Coinbase (exchangeService.ts)
- [x] fetch_exchange_price + compare_exchange_prices + 김치 프리미엄

### 3A-13+14: CCXT Pro WebSocket ✅
- [x] exchangeWsService.ts — 통합 실시간 시세/대형체결
- [x] Lazy connection, 5min idle disconnect

### 3A-15: CoinMarketCap API ✅
- [x] 보조 데이터 소스 (cmcApi.ts), Settings 키 관리
- [x] fetch_coin_data + fetch_market_overview 보강

### 3A-16: Investigation Mode Dynamic Panels ✅
- [x] update_investigation 도구 — add/remove/update/reorder/reset panels
- [x] Dynamic grid, cyan border for AI-added panels

### 3A-17: Webview Control Tools ✅
- [x] control_webview — navigate, resize, tv_change_symbol, tv_change_interval
- [x] webviewRefs Map for DOM access

**Result**: 7 → 17 AI tools. 1 → 6 exchanges. Any coin supported. Skeleton cards + sound + timeouts.

---

## Phase 3B: Personalization + Memory System (2-3 weeks)
**Goal**: "AI that knows me" + "continue where I left off" + multilingual support.

### 3B-1: Onboarding Flow
- [ ] Create src/renderer/components/Onboarding.tsx
  - Full-screen overlay on first launch
  - 5-step wizard:
    1. 사용하는 거래소 (복수 선택): Binance, Bybit, Upbit, OKX, Bitget, 기타
    2. 주 거래소 (위에서 선택한 것 중 1개)
    3. 트레이딩 스타일: 현물 / 선물 / 둘 다 / DeFi / 장기투자
    4. 관심 종목 (Watchlist): 자유 입력
    5. 선호 언어: 한국어 / English / 자동 감지
  - Optional advanced: 경험 수준, 중시 지표, 투자 성향
  - Skip 가능 but 완료 시 차이 체감
- [ ] App.tsx: 프로필 없으면 Onboarding 먼저 표시
- [ ] Verify: 첫 실행 → 온보딩 → 프로필 저장 → 메인 화면

### 3B-2: User Profile System
- [ ] Create UserProfile interface in types
  - exchanges, primaryExchange, tradingStyle, watchlist, language
  - experienceLevel?, preferredIndicators?, riskProfile?
  - frequentCoins?, customDefinitions?
- [ ] Create src/renderer/stores/useProfileStore.ts
- [ ] Save to electron-store (persistent)
- [ ] Settings modal: "프로필 수정" 버튼
- [ ] Verify: Profile persists across restarts

### 3B-3: System Prompt Injection (Principle-Based)
- [ ] Update claude.ts system prompt:
  - Remove hardcoded Analysis Protocol
  - Add [AI PRINCIPLES] section
  - Add [USER PROFILE] section (from useProfileStore)
  - Add [PREVIOUS SESSION SUMMARY] section
  - Add [USER CUSTOM DEFINITIONS] section
- [ ] Verify: System prompt dynamically includes user profile

### 3B-4: Watchlist Preloading
- [ ] On app start: read profile.watchlist
- [ ] Background fetch: price + news for watchlist coins (Promise.all, 5s timeout)
- [ ] Cache in memory, serve to AI on first query
- [ ] Cold start → BTC, ETH, SOL default preload
- [ ] Verify: First watchlist coin query responds faster

### 3B-5: SQLite Episodic Memory
- [ ] Install better-sqlite3
- [ ] Create src/main/database.ts — setup + migrations
- [ ] Tables: sessions, mentions, insights, custom_definitions
- [ ] IPC handlers for DB operations
- [ ] Auto-save session on app close
- [ ] Verify: Session data persists across restarts

### 3B-6: Custom Definitions (주관적 표현 학습)
- [ ] AI detects user expressions → stores in custom_definitions
- [ ] Inject [USER CUSTOM DEFINITIONS] into system prompt
- [ ] Style Anchor: maintain user's investment philosophy
- [ ] Verify: AI uses custom terms correctly in subsequent sessions

### 3B-7: Canvas Save/Restore
- [ ] CanvasSnapshot: cards, webviews, camera, session ID
- [ ] Auto-save on app close
- [ ] "이전 작업 이어서 보기" option on start
- [ ] Verify: Close → reopen → cards restored

### 3B-8: Session Summary Generation
- [ ] On session end: Haiku compresses conversation summary
- [ ] Store in sessions table
- [ ] Next session: inject [PREVIOUS SESSION SUMMARY]
- [ ] Verify: AI recalls previous session context

### 3B-9: i18n (Korean/English)
- [ ] Create src/renderer/i18n/ with ko.json, en.json
- [ ] All UI text uses i18n keys
- [ ] Language follows profile.language
- [ ] Verify: Switch language → all UI changes

### 3B-10: News Translation
- [ ] English news → Korean via Haiku (batch, async, cached)
- [ ] Original + translated toggle
- [ ] Verify: English news appears translated for Korean users

### 3B-11: AI Self-Awareness of Limitations
- [ ] Tool failure → explicit "데이터 가져올 수 없음" message
- [ ] Training data fallback → "실시간 아닐 수 있음" disclaimer
- [ ] Investment disclaimer toggle
- [ ] Verify: AI communicates uncertainty clearly

### 3B-12: Autonomous Data Subscription Step 1
- [ ] Watchlist-based auto WebSocket subscription
- [ ] Price alert: watchlist coin ±5% → auto notification card
- [ ] News filter: watchlist priority
- [ ] Verify: Watchlist coin spike → alert auto-spawns

**Done when**: Onboarding, profile-driven AI, episodic memory, canvas save/restore, i18n, AI limitations awareness.

---

## Phase 3 Deferred (Post-Team)
- Autonomous data subscription Step 2-3
- CCXT 100+ exchanges
- Advanced webview DOM control
- Mobile/web version
- Advanced custom definitions learning