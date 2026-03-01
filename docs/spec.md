# TRAVIS — Functional Specification v3

---

# PHASE 1 (COMPLETE)

## 1. Core Concept

TRAVIS is a desktop app where **everything happens through chat**.
User speaks naturally → AI understands intent → AI spawns visual cards and websites on canvas with cinematic animations.

There are NO hardcoded scenarios. NO `if (message.includes("BTC"))` logic.
Claude AI decides EVERYTHING: what to show, how many cards, what content, which websites.

Cards display **real-time data** that updates live via WebSocket, with latency indicators showing data freshness.

## 2. Screen Layout (Phase 1)

```
┌──────────────────────────────────────┬──────────────┐
│                                      │              │
│                                      │   Chat       │
│           Canvas                     │   Panel      │
│     (cards & webviews float here)    │              │
│                                      │  [messages]  │
│                                      │              │
│                                      │  [input box] │
└──────────────────────────────────────┴──────────────┘

Canvas : Chat = roughly 75% : 25% width
Chat panel on the right side, collapsible
```

## 3. Boot Sequence

When the app launches, a cinematic boot animation plays before the main interface appears.

### 3.1 Boot Flow
1. Dark screen → TRAVIS logo fades in with subtle glow
2. Orbital ring animation around logo (like Iron Man HUD boot)
3. System status text scrolls: "Connecting to market data...", "AI systems online...", "Canvas ready."
4. Logo and rings dissolve → Canvas + ChatPanel slide in
5. Total duration: 3-4 seconds

### 3.2 Design
- Background: near-black (#0a0a0f)
- Primary color: purple (#a855f7) with cyan (#22d3ee) accents
- Font: monospace for system text (JetBrains Mono or similar)
- Subtle particle/grid effects in background
- Smooth easing transitions throughout

## 4. Chat → AI → Canvas Flow

### 4.1 User Input
- Text input at bottom of ChatPanel
- Send on Enter (Shift+Enter for newline)
- Show user message in chat immediately

### 4.2 AI Processing
- Send to Claude API with:
  - **System prompt**: TRAVIS role definition + user's context prompt + current canvas state + chat history
  - **Tools**: spawn_card, spawn_webview, remove_cards, rearrange, update_card, open_investigation
  - **Messages**: full conversation history
- Claude freely decides which tools to call (0 to many)
- Claude also returns a text response (shown in chat)

### 4.3 System Prompt Structure
```
You are TRAVIS, an AI assistant that helps users analyze cryptocurrency markets.
When the user asks anything, you should:
1. Understand their intent
2. Use your tools to spawn relevant information cards and websites on the canvas
3. Provide a brief text summary in chat

You can spawn multiple cards at once. Be generous with visual information.
Always think about what data would help the user understand the topic better.
Include relevant images, charts, and visual data in cards when helpful.
When spawning coin-related cards, they will automatically receive real-time price updates.

[USER CONTEXT PROMPT]
{The user's custom instructions from Settings}

[CURRENT CANVAS STATE]
{List of currently visible cards with their titles and types}

[CHAT HISTORY]
{Previous messages in this session}
```

### 4.4 Canvas Response — Cinematic Spawn
When AI spawns cards, they don't just "appear". They spawn cinematically:

1. **Glow point**: A small purple glow appears at the target position
2. **Expand**: The glow expands into the card outline (0.3s)
3. **Content fill**: Card content fades in from top to bottom (0.2s)
4. **Settle**: Subtle bounce/settle animation (0.1s)

For **group spawns** (multiple cards at once):
- Cards spawn in cascade with 150ms delay between each
- Camera smoothly pans to center the new card group

## 5. Card System

### 5.1 spawn_card
```typescript
spawn_card: {
  title: string
  content: string
  cardType?: string    // "analysis" | "data" | "summary" | "comparison" | "news" | "price"
  width?: number       // Default: 380
  height?: number      // Default: auto
  symbol?: string      // If set, subscribes to real-time data
  images?: Array<{ url: string, caption?: string }>
}
```

### 5.2 spawn_webview
```typescript
spawn_webview: {
  url: string
  title: string
  width?: number       // Default: 900
  height?: number      // Default: 700
}
```

### 5.3 remove_cards
```typescript
remove_cards: { target: "all" | string }
```

### 5.4 rearrange
```typescript
rearrange: { layout: "grid" | "stack" }
```

### 5.5 update_card
```typescript
update_card: { cardId: string, content: string }
```

### 5.6 open_investigation
```typescript
open_investigation: { cardId: string }
```

### 5.7 search_web
```typescript
search_web: {
  query: string    // Search query for web search via Tavily
}
```
AI uses this tool to search the web for current information when needed.
Results are returned to AI for analysis. Powered by Tavily API.

## 6. Card UI

Each card on canvas has:
- Header bar: Title + latency indicator + close(×) button
- Latency indicator: Green(< 1s) / Yellow(1-5s) / Red(> 5s) / Gray(none)
- Content area: Markdown → HTML, inline images
- Real-time data: symbol → live price/volume via WebSocket
- Draggable, Resizable, Closeable
- Double-click header → Investigation Mode

## 7. Real-Time Data System

- Binance WebSocket (spot): wss://stream.binance.com:9443/ws
- Dynamic subscribe/unsubscribe per symbol
- Auto-reconnect with exponential backoff
- Extensible DataSource interface for future exchanges

## 8. Investigation Mode

- Full-screen overlay, 6-panel 3×2 grid
- Panels: Overview, Chart, News, Whale, On-chain, Sector
- Maximize(⤢), Fold(─) per panel
- Scan line animation, staggered entrance
- ESC or X to close

### 8.1 Dynamic Panel Data (Phase 2D-3)
- **Overview**: Real-time price ticker + card content (markdown)
- **Chart**: Candlestick chart (lightweight-charts v5, 1H interval from Binance REST klines)
- **News**: Feed items filtered by coin symbol/name from useFeedStore
- **Whale Activity**: Large trades from Binance REST (>$100K quoteQty threshold)
- **On-chain Data**: CoinGecko market data — market cap, supply, ATH/ATL, 24h/7d/30d performance
- **Sector Compare**: Same-sector coins comparison table (Binance 24hr tickers)
- Each panel loads independently; failures don't affect other panels
- Loading states: spinner per panel; error states: red error message per panel
- Symbol → CoinGecko ID mapping (22 coins) and sector mapping (6 sectors)

## 9. Canvas
- Infinite pan/zoom, dark background with grid
- Smart card placement

## 10. Settings
- API Key, Context Prompt, Model selector
- **Tavily API Key**: Web search API key input (stored locally, used for Tavily search)
- Stored in localStorage

---

# PHASE 2: MOSAIC INTELLIGENCE PLATFORM

## 11. Overall Philosophy

Phase 2 transforms TRAVIS from a "chat → cards" tool into a full **Mosaic Intelligence Platform**.

**TRAVIS**: AI-Powered System Optimizing the Entire Trading Process

Key principles:
- **Raw Feed first**: AI highlights but never hides data
- **Everything connects**: Nodes on canvas have edges showing relationships (revealed on hover, not always visible)
- **Multi-source**: Data from as many sources as possible (exchanges, on-chain, news, social, macro)
- **Two views**: COMMAND (analysis workspace) + FEED (information collection)

## 12. Screen Layout (Phase 2)

### 12.1 Tab System
Top-level tabs to switch between views:

```
[◈ COMMAND] [◈ FEED]
```

- COMMAND = Analysis workspace (JUDGE + EXECUTE in killchain)
- FEED = Information collection (DETECT + COLLECT in killchain)
- Tabs at top of app, below title bar
- Active tab has purple underline + glow
- Tab switch is instant (no reload, state preserved)

### 12.2 COMMAND Tab (Analysis Workspace)

```
┌──────────────┬────────────────────────────────┬───────────────┐
│              │                                │               │
│  Breaking    │      MOSAIC CANVAS              │   AI CHAT     │
│  News Feed   │      (main workspace)           │   (264px)     │
│  (220px)     │                                │               │
│              │   [Node]────→[Node]            │  User message  │
│  [CRITICAL]  │       ↑                        │               │
│  news text   │   [Node]←───[Node]             │  AI response   │
│              │                                │  (canvas sync) │
│  [ALERT]     │                                │               │
│  [SIGNAL]    │                                │               │
├──────────────┴────────────────────────────────┴───────────────┤
│  BTC -2.3% │ ETH +1.2% │ SOL -0.5% │ S&P +0.3% │ ...scroll  │
└───────────────────────────────────────────────────────────────┘
```

Left: Breaking News Feed (220px)
Center: Mosaic Canvas (existing canvas, now with hover-reveal node edges)
Right: AI Chat (264px, existing ChatPanel)
Bottom: Scrolling Price Ticker

### 12.3 FEED Tab (Information Collection)

```
┌──────────────────────────────────────┬────────────────┐
│                                      │                │
│       WORLD MAP                      │   RAW FEED     │
│                                      │   Sidebar      │
│  Event pins on dark world map        │   (300px)      │
│  (critical/alert/signal/info)        │                │
│                                      │  [Filters]     │
│  Pin hover → tooltip                 │  [Search]      │
│  Pin click → detail modal            │                │
│                                      │  [Feed items]  │
└──────────────────────────────────────┴────────────────┘
│              ↓ drag to expand                          │
┌───────────────────────────────────────────────────────┐
│                  ALL COLUMNS VIEW                      │
│ MACRO│CRYPTO│ON-CHAIN│EXCHANGE│SOCIAL│STOCKS│WORLD    │
│ items│items │ items  │ items  │items │items │items    │
└───────────────────────────────────────────────────────┘
```

Upper: World Map + Feed Sidebar
Lower: Drag-to-expand 7-column Raw Feed view

## 13. Breaking News Feed (Left Panel — COMMAND Tab)

### 13.1 Feed Levels
- **CRITICAL** (red bg): Major market-moving events
- **ALERT** (yellow): Notable changes requiring attention
- **SIGNAL** (purple): Patterns or signals detected
- **INFO** (gray): General information

### 13.2 Feed Behavior
- New items slide in at top with animation
- Each item: importance badge + timestamp + title + source
- Click → detail modal with AI analysis
- **Drag item onto canvas → creates new node** (key interaction!)
- Auto-scroll, but pauses on hover
- Category color strip on left edge per item

### 13.3 Data Sources

**Phase 2 — Free / Accessible:**
- CryptoPanic API (crypto news aggregation, free tier)
- CoinGecko (market data, free tier)
- CoinMarketCap / CMC (market data, free tier)
- Alternative.me Fear & Greed Index (free)
- Exchange announcement pages (Binance, OKX, Bybit, Upbit — RSS/free API)
- Exchange status pages (free)
- GDELT (global events, free)
- DeFiLlama (TVL data, free)
- CoinMarketCal (crypto events calendar, free tier)

**Phase 3 — Paid / Requires Special Access:**
- Coinness (Korean crypto news — requires scraping or partnership)
- X/Twitter API (paid tier for full access)
- Reddit API (rate limited)
- Telegram channel monitoring (bot required)
- Discord alerts (bot required)
- The Block, Decrypt, CoinDesk (may require API agreements)
- Glassnode, Nansen (paid on-chain analytics)
- Bloomberg, Reuters (enterprise pricing)

## 14. Node-Edge System (Canvas Enhancement)

### 14.1 Edge Visibility — Hover-Reveal System
Edges exist between related nodes but are **hidden by default** to keep the canvas clean.

**Visibility rules:**
- Default state: all edges invisible (opacity 0)
- Hover on node: that node's direct edges fade in (opacity 0.6, 0.2s transition)
- Click on node: edges stay visible (pinned)
- Shift+Click: show 2nd-degree edges (connections of connections)
- Toggle button in toolbar: show/hide ALL edges globally
- Click empty canvas: un-pin all edges

**Edge styling when visible:**
- Strong: solid thick line (2px)
- Weak: thin line (1px)
- Speculative: dotted line (1px)
- Colors: match source node's category color
- Optional: animated particles moving along edge (subtle, slow)

### 14.2 Edge Data
```typescript
Edge: {
  id: string
  fromNodeId: string
  toNodeId: string
  strength: "strong" | "weak" | "speculative"
  label?: string       // e.g. "causes", "correlates", "precedes"
  animated: boolean    // particle flow animation
}
```

## 15. Price Ticker (Bottom Bar)

### 15.1 Layout
- Fixed bar at very bottom of app (below StatusBar)
- Infinite horizontal scroll animation (right to left)
- Symbols: BTC, ETH, SOL, BNB, XRP, S&P 500, NASDAQ, DXY, GOLD, OIL, etc.

### 15.2 Display
- Each item: SYMBOL price change%
- Green for positive, Red for negative
- Click on ticker item → spawns card for that symbol on canvas
- Data from Binance WebSocket (crypto) + free REST APIs (traditional)

## 16. FEED Tab (Information Collection)

### 16.1 World Map (Upper Section)
- Interactive world map (dark theme)
- Event pins with ping animation at event locations
- Pin colors match feed levels (critical=red, alert=yellow, etc.)
- Hover pin → tooltip with event summary
- Click pin → detail modal with AI analysis + "Add to COMMAND" button
- Library: react-simple-maps or similar lightweight option

### 16.2 Feed Sidebar (Right, 300px)
- Unified raw feed (all categories mixed)
- Filter toggles per category (7 toggles)
- Search bar
- Each item: category color dot + importance badge + title + time
- Click item → modal + "Add to COMMAND" button

### 16.3 Multi-Column Raw Feed (Lower, Expandable)
- Drag handle or click to expand bottom panel (slide-up animation)
- **7 columns**, each independently scrolling:
  - MACRO | CRYPTO | ON-CHAIN | EXCHANGE | SOCIAL | STOCKS | WORLD
- Each column updates in real-time
- Item display varies by importance level (HIGH/MED/LOW)
- AI relevance bar on each item (not filtering, just scoring)
- Click item → modal with details + "Add to COMMAND" button

### 16.4 Event Calendar
- Monthly calendar grid view
- Events marked on dates with category color dots
- Event types: token unlocks, FOMC, CPI, earnings, hard forks
- Click date → list of events for that day
- Click event → detail modal
- Data: CoinMarketCal (crypto), hardcoded FOMC/CPI schedule

## 17. Enhanced AI Chat (Phase 2)

### 17.1 Canvas-Chat Linkage (focusedCard Context)
- Click card content → activates card as chat context (purple border + context bar in chat)
- Subsequent user messages reference the focused card's content via [FOCUSED CARD CONTEXT] in system prompt
- Click ✕ on context bar or empty canvas → clears focused card
- Clicking a different card switches focus automatically
- AI can proactively suggest new nodes based on conversation context

### 17.2 Typing Animation
- AI responses stream with typing effect (not instant dump)

### 17.3 Loading Experience
- While AI processes: subtle pulsing animation in chat
- Preview text: "Analyzing market data..." → "Generating insights..." → actual response

## 18. Non-Goals for Phase 2
- No voice input — Phase 3
- No autonomous trading execution — Phase 3
- No mobile version — Phase 3
- No social/sharing features — Phase 3
- No paid data source APIs (Glassnode, Nansen, Bloomberg) — Phase 3
- No X/Twitter API integration — Phase 3
- No Telegram/Discord bot monitoring — Phase 3

---

# PHASE 3A: AI TOOL ARSENAL + PERCEIVED SPEED (COMPLETE ✅)

## 19. AI Tool System (17 Tools)

Phase 3A expanded Claude's tool arsenal from 7 to 17, enabling real data queries instead of training-data guessing.

### 19.1 Dynamic Symbol Resolution
- CoinGecko /search API for resolving any coin (symbol, name, Korean name)
- Session cache (Map) to avoid redundant lookups
- Korean coin name mapping (비트코인→BTC, 이더리움→ETH, etc.)
- Removed KNOWN_SYMBOLS hardcoding

### 19.2 Data Tools (8 tools)
```typescript
// 코인 종합 데이터 — CoinGecko + Binance + optional Futures + optional CMC
fetch_coin_data: { query: string, include_futures?: boolean }

// 시장 전체 현황 — 글로벌 메트릭 + Fear&Greed + Top gainers/losers + optional CMC
fetch_market_overview: {}

// 선물 파생상품 — Binance Futures 8개 API
fetch_derivatives_data: { symbol: string }
// Returns: funding rate, OI, global long/short, top trader L/S, taker buy/sell, OI history, liquidations

// 고래 거래 — 대형 체결 + 호가벽
fetch_whale_activity: { symbol?: string }

// 트렌딩 — CoinGecko trending coins/NFT/categories
fetch_trending: {}

// 특정 거래소 가격 — CCXT 6거래소
fetch_exchange_price: { exchange: string, symbol: string }

// 멀티 거래소 비교 + 김치 프리미엄
compare_exchange_prices: { symbol: string, mode?: 'compare'|'kimchi', exchanges?: string[] }

// 웹 검색 — Tavily API
search_web: { query: string }
```

### 19.3 Display Tools (7 tools)
```typescript
spawn_card: { title, content, cardType?, symbol?, images?, relatedTo? }
spawn_webview: { url, title, width?, height? }
spawn_multiple_cards: { cards: [{title, content, cardType?, symbol?}], webviews?: [{url, title}] }
remove_cards: { target: 'all' | cardId }
rearrange: { layout: 'grid' | 'stack' }
update_card: { cardId, content }
control_webview: { webviewId, action: 'navigate'|'resize'|'tv_change_symbol'|'tv_change_interval', url?, symbol?, interval?, width?, height? }
```

### 19.4 Analysis Tools (2 tools)
```typescript
open_investigation: { cardId: string }
update_investigation: { action: 'add_panel'|'remove_panel'|'update_panel'|'reorder_panels'|'reset_panels', panelId?, panel?, panelIds? }
```

## 20. CCXT 6-Exchange Integration
- Exchanges: Binance, Upbit, Bybit, Bithumb, OKX, Coinbase
- REST: fetchTicker, fetchOrderBook via CCXT unified API
- WebSocket: CCXT Pro with lazy connection + 5min idle disconnect
- 김치 프리미엄: Upbit KRW vs Binance USDT × exchange rate

## 21. CoinMarketCap (Supplementary)
- Optional API key in Settings
- Augments fetch_coin_data: rank, tags, percentChange1h/30d, dateAdded, platform
- Augments fetch_market_overview: DeFi volume/mcap, stablecoin volume/mcap, total exchanges
- Failure never affects primary CoinGecko data

## 22. Perceived Speed Improvements
- **Skeleton Cards**: spawn_card immediately creates skeleton (shimmer animation) → content fills after data arrives
- **SSE Timeout**: 60s no-event → auto-disconnect + error message
- **Tool Timeout**: 30s per tool execution
- **Sound Feedback**: Web Audio API — boot complete, card spawn, AI response sounds
- **fetchWithRetry**: Exponential backoff for CoinGecko API (3 retries)
- **Multi-turn**: MAX_TOOL_TURNS = 25

## 23. Investigation Mode Dynamic Panels
- AI can add/remove/update/reorder panels via update_investigation tool
- Dynamic grid: 1-3 columns based on panel count
- Dynamic panels get cyan border + remove button
- Panel sizes: small, normal, large (grid span)

## 24. Webview Control
- control_webview tool with 4 actions:
  - navigate: Change URL (store update + loadURL)
  - resize: Change dimensions
  - tv_change_symbol: TradingView chart symbol change
  - tv_change_interval: TradingView chart timeframe change
- webviewRefs Map for DOM element access