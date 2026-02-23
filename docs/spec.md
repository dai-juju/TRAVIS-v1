# TRAVIS Phase 1 — Functional Specification v2

## 1. Core Concept

TRAVIS is a desktop app where **everything happens through chat**.
User speaks naturally → AI understands intent → AI spawns visual cards and websites on canvas with cinematic animations.

There are NO hardcoded scenarios. NO `if (message.includes("BTC"))` logic.
Claude AI decides EVERYTHING: what to show, how many cards, what content, which websites.

Cards display **real-time data** that updates live via WebSocket, with latency indicators showing data freshness.

## 2. Screen Layout

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
{The user's custom instructions from Settings, e.g. "I mainly trade BTC and ETH on Binance futures"}

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
- Connection lines briefly flash between related cards

## 5. Card System

### 5.1 spawn_card
AI creates a card with any content it wants. This is the core of TRAVIS.

```typescript
spawn_card: {
  title: string          // Card header text
  content: string        // Markdown or HTML content - AI writes freely
  cardType?: string      // Optional: "analysis" | "data" | "summary" | "comparison" | "news" | "price"
  width?: number         // Default: 380
  height?: number        // Default: auto (fit content)
  symbol?: string        // If set, card subscribes to real-time data for this symbol
  images?: Array<{       // Optional images/charts to display in card
    url: string          // Image URL
    caption?: string     // Image caption
  }>
}
```

**Examples of what AI might generate:**

"BTC 분석해" →
- Card 1: "BTC 시장 현황" — 실시간 가격, 변동률, 거래량 (symbol: "BTCUSDT" → auto-updates)
- Card 2: "BTC 기술적 분석" — RSI, 추세, 지지/저항 분석 + 차트 이미지
- Card 3: "관련 뉴스" — 최근 주요 뉴스 요약
- Webview: TradingView BTC 차트

"요즘 AI 코인 어때?" →
- Card 1: "AI 섹터 주요 코인" — TAO, RNDR, FET 비교표 (각각 실시간 가격)
- Card 2: "AI 섹터 전망" — 분석 의견 + 섹터 차트 이미지

### 5.2 spawn_webview
AI opens a real website on the canvas. AI determines the URL based on context.

```typescript
spawn_webview: {
  url: string           // Full URL to embed
  title: string         // Display title
  width?: number        // Default: 600
  height?: number       // Default: 450
}
```

**Example websites AI might open** (not limited to these):
- TradingView: `https://www.tradingview.com/chart/?symbol=BINANCE:BTCUSDT`
- CoinMarketCap: `https://coinmarketcap.com/currencies/bitcoin/`
- Coinglass: `https://www.coinglass.com/tv/Binance_BTCUSDT`
- Binance: `https://www.binance.com/en/trade/BTC_USDT`
- Any other relevant website the AI deems useful (exchanges, news sites, analytics platforms, etc.)

### 5.3 remove_cards
```typescript
remove_cards: {
  target: "all" | string  // "all" or specific card ID
}
```

### 5.4 rearrange
```typescript
rearrange: {
  layout: "grid" | "stack"
}
```

### 5.5 update_card
```typescript
update_card: {
  cardId: string
  content: string
}
```

### 5.6 open_investigation
```typescript
open_investigation: {
  cardId: string    // Card to investigate — opens Investigation Mode
}
```

## 6. Card UI

Each card on canvas has:
- **Header bar**: Title text + latency indicator + close(×) button
- **Latency indicator**: Small colored dot + "0.2s" text showing data delay
  - Green (< 1s): Real-time
  - Yellow (1-5s): Slight delay
  - Red (> 5s): Stale data
  - Gray: No real-time connection (static content)
- **Content area**: Renders markdown as HTML, supports inline images and charts
- **Real-time data**: If card has a symbol, price/volume update live via WebSocket
- **Draggable**: Click header to drag
- **Resizable**: Drag corner handle to resize
- **Close**: × button removes card
- **Double-click header**: Opens Investigation Mode for this card

Webview cards additionally:
- Show website in an iframe/webview
- Have a URL bar showing current URL (read-only)
- Reload button

## 7. Real-Time Data System

### 7.1 WebSocket Connection
- Connect to Binance WebSocket streams on app start
- Subscribe to symbols as cards are spawned (e.g., btcusdt@ticker)
- Unsubscribe when cards are removed
- Auto-reconnect on disconnect

### 7.2 What Updates in Real-Time
- Price (last trade price)
- 24h change percentage
- 24h volume
- Funding rate (futures)

### 7.3 Latency Tracking
- Each WebSocket message carries a timestamp
- Compare server timestamp vs local time → calculate latency
- Display latency per card in header
- Show overall connection status in app status bar

### 7.4 Card Update Behavior
- Price changes flash green (up) or red (down) briefly
- Numbers animate smoothly between values (not jump)
- Volume bars update in real-time if displayed

## 8. Investigation Mode

### 8.1 Trigger
- Double-click any card header on canvas
- Or AI calls open_investigation tool
- Full-screen overlay appears on top of canvas (canvas is still visible behind blur)

### 8.2 Layout
```
┌──────────────────────────────────────────────────────┐
│  🔍 TAO — Bittensor                    [X] Close    │
│  ─────────────────────────────────────────────────── │
│  ┌────────────┬──────────────────┬────────────┐      │
│  │            │                  │            │      │
│  │  Overview  │     Chart        │   News     │      │
│  │  (main)    │                  │            │      │
│  │            │                  │            │      │
│  ├────────────┼──────────────────┼────────────┤      │
│  │            │                  │            │      │
│  │  Whale     │    On-chain      │  Sector    │      │
│  │  Activity  │    / Unlocks     │  Compare   │      │
│  │            │                  │            │      │
│  └────────────┴──────────────────┴────────────┘      │
│  ──── scan line animation ────────────────────────── │
└──────────────────────────────────────────────────────┘
```

### 8.3 Panel Grid
- 6 panels in 3×2 grid (configurable per card type)
- Main panel (top-left) is slightly larger, highlighted with glow border
- Each panel has: header (title + tag badge) + scrollable body + action buttons

### 8.4 Panel Features
- **Drag to reposition**: Grab panel header to move within grid
- **Resize**: Drag corner handle
- **Maximize**: ⤢ button → panel takes full grid area
- **Pop-out**: ↗ button → panel opens as overlay popup for detailed view
- **Fold/Collapse**: ─ button → panel collapses to header only
- **LLM tag badge**: Shows which AI model processed this panel's data (CLAUDE / LOCAL / STREAM)

### 8.5 Panel Content by Card Type

**For coin cards:**
| Panel | Content |
|-------|---------|
| Overview (main) | Price, change%, MCAP, Volume, RSI, MACD, BB, Funding — all real-time |
| Chart | Candlestick chart with indicators |
| News | Latest 5 news items related to this coin |
| Whale | Recent whale buy/sell transactions |
| Unlocks / On-chain | Token unlock schedule, active addresses, exchange flows |
| Sector | Same-sector coins comparison table |

**For other card types:**
- Main panel shows the selected card's full content
- Remaining panels show content from other visible canvas cards
- This lets users cross-reference information across multiple data sources

### 8.6 Visual Design
- Background: near-black with blur overlay on canvas
- Subtle grid lines in background
- Scan line animation across top (horizontal light sweep, 3.5s loop)
- Panels cascade in with staggered animation (0.1s delay each)
- Purple/cyan color scheme consistent with boot sequence

### 8.7 Close
- ESC key or X button → smooth fade out → return to canvas
- Canvas state is preserved exactly as before

## 9. Canvas

- Infinite scrollable area (pan by dragging empty space)
- Zoom in/out with mouse wheel
- Dark background (near-black, #0a0a0f) with subtle grid pattern
- Cards can overlap, user drags to arrange
- Smart placement: new cards appear near related cards, away from unrelated ones

## 10. Settings

Accessible via gear icon in ChatPanel header.
Simple modal with:

- **API Key**: Claude API key input (stored locally, never sent anywhere except Anthropic)
- **Context Prompt**: Textarea where user writes custom instructions for the AI
  - Example: "나는 바이낸스 선물에서 주로 BTC, ETH, SOL을 거래해. 단타 위주야."
  - This gets injected into Claude's system prompt every time
- **Model**: Dropdown to select Claude model (default: claude-sonnet-4-20250514)

## 11. Data Flow Diagram

```
User types "TAO 분석해"
        │
        ▼
ChatPanel.tsx
  → adds user message to useChatStore
  → calls claude.ts.sendMessage()
        │
        ▼
claude.ts
  → builds messages array (system prompt + history + new message)
  → calls Claude API with tools
  → receives response with tool_use blocks
        │
        ▼
Parse tool calls:
  tool_use: spawn_card({title: "TAO 현황", content: "...", symbol: "TAOUSDT"})
  tool_use: spawn_card({title: "TAO 분석", content: "...", images: [...]})
  tool_use: spawn_webview({url: "https://tradingview.com/...", title: "TAO 차트"})
  text: "TAO를 분석했습니다..."
        │
        ▼
useCanvasStore.addCard() × 2   ← with cinematic spawn animation
useCanvasStore.addWebview() × 1
useChatStore.addMessage(assistant text)
binanceWs.subscribe("taousdt")  ← start real-time updates
        │
        ▼
Canvas re-renders → cards appear with glow → expand → content fill
Cards auto-update with live price data
Latency indicator shows "0.2s" in green
```

## 12. Non-Goals for Phase 1
- No Insight Pulse (cross-card AI analysis alerts) — Phase 2
- No voice input — Phase 2
- No bi-directional linking / knowledge graph — Phase 2
- No session save/restore — Phase 2
- No autonomous alerts — Phase 2