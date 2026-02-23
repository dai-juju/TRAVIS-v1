# TRAVIS Phase 1 — Development Plan v2

## Overview
Build the complete Phase 1 experience:
Boot sequence → Chat with AI → Cinematic card spawns → Real-time data → Investigation Mode.
Each phase builds on the previous one. Complete phases in order.

---

## Phase 1-1: Project Setup
**Goal**: Electron + React + TypeScript project that opens a window.

- [ ] Initialize npm project with package.json
- [ ] Install dependencies: electron, react, react-dom, typescript, vite, @vitejs/plugin-react, tailwindcss, zustand, framer-motion
- [ ] Install dev dependencies: electron-builder, concurrently
- [ ] Create vite.config.ts for renderer
- [ ] Create tsconfig.json (main + renderer)
- [ ] Create src/main/index.ts — basic Electron window that loads renderer
- [ ] Create src/renderer/index.html — root HTML with dark theme
- [ ] Create src/renderer/main.tsx — React entry point
- [ ] Create src/renderer/App.tsx — placeholder "Hello TRAVIS"
- [ ] Configure npm scripts: dev, build
- [ ] Verify: `npm run dev` opens Electron window showing "Hello TRAVIS"

**Done when**: Electron window opens with React rendering inside.

---

## Phase 1-2: Boot Sequence
**Goal**: Cinematic startup animation before main interface appears.

- [ ] Create src/renderer/components/BootSequence.tsx
  - Dark screen (#0a0a0f) → TRAVIS logo fade in with purple glow
  - Orbital ring animation around logo (CSS or Framer Motion)
  - System status text scroll: "Connecting...", "AI online...", "Canvas ready."
  - Logo dissolves → main interface slides in
  - Total duration: 3-4 seconds
- [ ] Design assets: TRAVIS logo (text-based is fine), purple (#a855f7) + cyan (#22d3ee)
- [ ] Font: JetBrains Mono for system text
- [ ] Update App.tsx: Show BootSequence first, then transition to main layout
- [ ] Verify: App opens → boot animation plays → main screen appears

**Done when**: App boots with cinematic animation before showing canvas.

---

## Phase 1-3: Layout (Canvas + Chat Panel)
**Goal**: Split screen into canvas area and chat panel.

- [ ] Create src/renderer/stores/useChatStore.ts — messages array
- [ ] Create src/renderer/stores/useCanvasStore.ts — cards array, positions
- [ ] Create src/renderer/components/ChatPanel.tsx
  - Message list (scrollable)
  - Text input at bottom
  - Send button (or Enter to send)
  - User messages appear immediately in chat
  - Gear icon in header for settings
- [ ] Create src/renderer/components/Canvas.tsx
  - Dark background (#0a0a0f) with subtle grid pattern
  - Pan by dragging empty space
  - Zoom with mouse wheel
  - Empty for now, will render cards later
- [ ] Update App.tsx — flex layout: Canvas (75%) + ChatPanel (25%)
- [ ] TailwindCSS dark theme setup
- [ ] Verify: Can type messages and see them in chat, can pan/zoom canvas

**Done when**: Split layout works, chat messages display, canvas pans and zooms.

---

## Phase 1-4: Claude API Integration
**Goal**: Chat messages go to Claude API and get responses with tool use.

- [ ] Create src/renderer/types/index.ts — define Card, WebviewCard, Message, ToolCall types
- [ ] Create src/renderer/services/claude.ts
  - sendMessage(messages, canvasState, contextPrompt) function
  - System prompt builder (TRAVIS role + context prompt + canvas state)
  - Tool definitions (spawn_card, spawn_webview, remove_cards, rearrange, update_card, open_investigation)
  - Parse response: extract tool_use blocks + text content
  - Handle tool results and multi-turn tool use
- [ ] Create src/main/ipc.ts — IPC bridge for API calls
  - Renderer sends message → Main process calls Claude API (keeps API key safe)
  - Main returns response to renderer
- [ ] Create src/renderer/stores/useSettingsStore.ts
  - apiKey, contextPrompt, model (stored in localStorage)
- [ ] Create Settings modal (gear icon in ChatPanel header)
  - API Key input (password field)
  - Context Prompt textarea
  - Model selector dropdown
  - Save to localStorage, load on app start
- [ ] Wire up ChatPanel: user sends message → claude.ts → show AI text response in chat
- [ ] Add loading state while waiting for Claude response
- [ ] Add error handling (API errors, network errors, missing API key prompt)
- [ ] Verify: Type a message, get Claude's text response in chat

**Done when**: Can chat with Claude through the app. Tool calls are parsed but not yet rendered.

---

## Phase 1-5: Card Rendering + Cinematic Spawn
**Goal**: AI's spawn_card tool calls appear as draggable cards with cinematic animation.

- [ ] Create src/renderer/components/SpawnAnimation.tsx
  - Phase 1: Purple glow point appears at target position (0.15s)
  - Phase 2: Glow expands to card outline (0.3s)
  - Phase 3: Card content fades in top-to-bottom (0.2s)
  - Phase 4: Subtle settle/bounce (0.1s)
  - For group spawns: cascade with 150ms delay between cards
- [ ] Create src/renderer/components/Card.tsx
  - Renders title (header bar) + content (markdown → HTML)
  - Support inline images (from images[] parameter)
  - Close (×) button → removes card from store
  - Draggable by header (mousedown/mousemove/mouseup)
  - Resizable by corner handle
  - Dark card style (dark gray bg, light text, subtle border, purple accent)
  - Double-click header → triggers Investigation Mode
- [ ] Install markdown renderer (react-markdown + remark-gfm for tables)
- [ ] Update useCanvasStore.ts
  - addCard(card) — adds card with auto-calculated position + triggers spawn animation
  - removeCard(id) — removes card with fade-out
  - updateCardPosition(id, x, y) — for drag
  - updateCardSize(id, w, h) — for resize
- [ ] Smart placement: new cards placed to right of last card, wrap to next row if full
- [ ] Camera auto-pan: after spawn, smoothly pan canvas to center new card group
- [ ] Wire up: claude.ts spawn_card tool call → SpawnAnimation → useCanvasStore.addCard()
- [ ] Canvas.tsx renders all cards from store
- [ ] Verify: Ask Claude something → cards spawn with cinematic animation on canvas

**Done when**: AI-generated cards appear with glow animation, can be dragged and closed.

---

## Phase 1-6: Webview Rendering
**Goal**: AI's spawn_webview tool calls show real websites on canvas.

- [ ] Create src/renderer/components/WebviewCard.tsx
  - Uses Electron <webview> tag to embed URL
  - Header: title + URL display + reload button + close button
  - Draggable and resizable like regular cards
  - Spawns with same cinematic animation as regular cards
  - Handle webview security: sandbox, allowpopups configuration
  - Handle X-Frame-Options failures gracefully (show "Open in browser" fallback)
- [ ] Update useCanvasStore to handle webview cards alongside regular cards
- [ ] Wire up: claude.ts spawn_webview tool call → useCanvasStore.addWebview()
- [ ] Handle remove_cards and rearrange tool calls
- [ ] Verify: Ask Claude to open a website → website appears on canvas with animation

**Done when**: AI can spawn both info cards and live websites on canvas.

---

## Phase 1-7: Real-Time Data (WebSocket)
**Goal**: Cards with crypto symbols update live with real-time price data.

- [ ] Create src/renderer/services/binanceWs.ts
  - WebSocket manager: connect, subscribe, unsubscribe, reconnect
  - Subscribe to streams: {symbol}@ticker (price, volume, change%)
  - Parse incoming messages → update useRealtimeStore
  - Auto-reconnect on disconnect with exponential backoff
  - Track latency per stream (server timestamp vs local time)
- [ ] Create src/renderer/services/binanceRest.ts
  - Initial data fetch: GET /api/v3/ticker/24hr for symbol
  - Fallback when WebSocket is not yet connected
- [ ] Create src/renderer/stores/useRealtimeStore.ts
  - Live price data per symbol
  - Latency per symbol
  - Connection status (connected / reconnecting / disconnected)
- [ ] Create src/renderer/components/LatencyIndicator.tsx
  - Small dot + latency text in card header
  - Green (< 1s) / Yellow (1-5s) / Red (> 5s) / Gray (no connection)
- [ ] Update Card.tsx
  - If card has `symbol`, subscribe to real-time data on mount
  - Price changes flash green (up) or red (down) for 0.5s
  - Numbers animate smoothly between old and new values
  - Show LatencyIndicator in card header
  - Unsubscribe on card removal
- [ ] Show overall connection status in app status bar (bottom or top)
- [ ] Verify: Spawn a BTC card → price updates every second with green/red flash

**Done when**: Cards with symbols show live prices, latency is displayed, reconnection works.

---

## Phase 1-8: Investigation Mode
**Goal**: Full-screen analysis dashboard when double-clicking a card.

- [ ] Create src/renderer/components/InvestigationMode.tsx
  - Full-screen overlay with blur backdrop on canvas
  - Header: "🔍 {symbol} — {name}" + "INVESTIGATION MODE" badge + close button
  - 6-panel grid (3 columns × 2 rows)
  - Subtle grid lines in background
  - Scan line animation (horizontal light sweep across top, 3.5s loop)
  - Staggered panel entrance animation (0.1s delay per panel)
- [ ] Panel component (InvestigationPanel.tsx)
  - Header: title + LLM tag badge + action buttons
  - Scrollable body content
  - Drag to reposition within grid area
  - Resize via corner handle
  - Maximize button (⤢) → panel fills entire grid
  - Pop-out button (↗) → opens content in overlay popup
  - Fold button (─) → collapse to header only
- [ ] Panel content generation for coin cards:
  - Panel 1 (main): Overview — price, change%, mcap, volume, RSI, MACD, funding (real-time)
  - Panel 2: Chart — candlestick chart (can use lightweight-charts library or TradingView widget)
  - Panel 3: News — latest news items (from claude.ts AI call or cached)
  - Panel 4: Whale — recent whale transactions
  - Panel 5: On-chain / Unlocks — token unlock schedule, exchange flows
  - Panel 6: Sector — same-sector coin comparison
- [ ] Panel content for non-coin cards:
  - Panel 1 (main): selected card's full content
  - Remaining panels: content from other visible canvas cards for cross-reference
- [ ] Wire up: double-click card header → open InvestigationMode
  - Also wire up: open_investigation tool call from Claude
- [ ] Close: ESC key or X button → fade out → return to canvas (state preserved)
- [ ] Verify: Double-click a coin card → full-screen 6-panel grid appears with all data

**Done when**: Investigation Mode opens with 6 draggable/resizable panels, all data populated.

---

## Success Criteria
The app is "done" for Phase 1 when this scenario works:

1. App opens with cinematic boot sequence
2. User enters API key in Settings
3. User types "TAO 분석해줘"
4. AI spawns 2-3 info cards with cinematic glow animation
5. AI spawns a TradingView chart webview
6. AI responds in chat with a summary
7. Cards show live prices updating in real-time with latency indicator
8. User can drag and rearrange cards
9. User can close cards
10. User double-clicks TAO card → Investigation Mode opens with 6 panels
11. User can drag/resize/maximize panels in Investigation Mode
12. User presses ESC → returns to canvas
13. User types "화면 정리해" → AI removes cards
14. User types "바이낸스 열어줘" → AI spawns Binance webview