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

## Phase 2D: Advanced Features
**Goal**: Insight Pulse, enhanced AI, Investigation Mode upgrade, more data sources.

### 2D-1: Insight Pulse (Cross-Analysis Alerts)
- [ ] AI automatically analyzes relationships between canvas nodes
- [ ] When pattern detected: glowing 💡 chip appears on relevant nodes
- [ ] Click chip → popup with:
  - Pattern description
  - Historical pattern matching
  - Risk factors
  - Confidence score (0-100%)
- [ ] Triggers: new node added, price significant change, new critical news
- [ ] Verify: Multi-node pattern detected and displayed

### 2D-2: Enhanced AI Chat
- [ ] Typing animation (stream response character by character)
- [ ] Canvas-chat linkage:
  - AI response highlights related nodes
  - Click node → sends "Analyze this" to AI with node context
- [ ] Loading experience: pulsing animation + progress text
- [ ] AI proactively suggests new nodes when context warrants
- [ ] Verify: Typing effect works, node click → AI analysis

### 2D-3: Investigation Mode Upgrade
- [ ] AI fills each panel dynamically (not just Overview)
  - Chart: embed TradingView widget or lightweight-charts
  - News: live news from feedService filtered by coin
  - Whale: data from free whale tracking sources
  - On-chain: basic on-chain metrics
  - Sector: auto-comparison of same-sector coins
- [ ] Panel drag-to-reposition within grid
- [ ] Pop-out button (panel → floating overlay)
- [ ] Verify: All 6 panels have real dynamic data

### 2D-4: Additional Data Sources
- [ ] Binance Futures WebSocket (wss://fstream.binance.com/ws)
  - Funding rate, open interest
  - New DataSource implementation: BinanceFuturesSource
- [ ] Additional exchanges (as DataSource implementations):
  - Upbit WebSocket
  - Bybit WebSocket
- [ ] Additional free APIs:
  - CoinGecko (expanded usage)
  - Whale Alert (free tier)
  - GDELT (global events)
- [ ] Verify: Multiple data sources active, Investigation panels populated

### 2D-5: Webview Content Recognition
- [ ] Capture webview screen content (title, meta, or screenshot)
- [ ] Send webview context to Claude for relationship analysis
- [ ] Auto-create edges between webview and related canvas nodes
- [ ] Update edges when user navigates to different page within webview

**Done when**: Insight Pulse works, AI chat enhanced, Investigation panels filled, multiple data sources, webview content recognized.

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