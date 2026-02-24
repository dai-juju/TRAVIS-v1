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
- Claude API with tool use (AI brain)
- Vite (bundler)
- WebSocket (Binance real-time price/volume/funding streams)
- Framer Motion or CSS animations (boot sequence + cinematic spawn)

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
  main/                → Electron main process (window, IPC, API key)
    index.ts           → App entry point
    ipc.ts             → Main↔Renderer communication bridge
    preload.ts         → Secure IPC bridge (contextBridge)
    tavily.ts          → Tavily web search API handler
  renderer/            → React frontend (what user sees)
    App.tsx            → Root layout: Boot → TabSystem → Content
    components/
      BootSequence.tsx     → App startup cinematic animation
      Canvas.tsx           → Infinite canvas where cards/nodes live
      ChatPanel.tsx        → Right-side AI chat panel
      Card.tsx             → Single info card (AI-generated content)
      WebviewCard.tsx      → Embedded website card
      InvestigationMode.tsx → Full-screen 6-panel analysis grid
      InvestigationPanel.tsx → Single panel in Investigation Mode
      SpawnAnimation.tsx   → Cinematic card spawn effects
      LatencyIndicator.tsx → Real-time data delay indicator
      StatusBar.tsx        → Bottom connection status bar
      SettingsModal.tsx    → Settings popup (API key, model, context)
      TabBar.tsx           → Tab navigation (COMMAND / FEED)
      NewsFeed.tsx         → Left-side breaking news feed panel
      FeedItem.tsx         → Single news/feed item component
      NodeEdge.tsx         → Connection lines between cards/nodes (hover-reveal)
      PriceTicker.tsx      → Bottom scrolling price ticker
      MosaicFeed.tsx       → Full feed view (FEED tab)
      WorldMap.tsx         → World map with event pins (FEED tab)
      FeedColumn.tsx       → Single column in multi-column feed view
      EventCalendar.tsx    → Economic/crypto event calendar
    stores/
      useCanvasStore.ts    → Cards list, positions, zoom level, edges
      useChatStore.ts      → Chat messages history
      useSettingsStore.ts  → User settings (context prompt, API key)
      useRealtimeStore.ts  → WebSocket connection state, live price data
      useInvestigationStore.ts → Investigation Mode state
      useTabStore.ts       → Active tab state
      useFeedStore.ts      → News feed items, categories, importance
    services/
      claude.ts          → Claude API call + tool use response parser
      dataSource.ts      → DataSource interface + DataSourceManager
      binanceWs.ts       → Binance WebSocket (DataSource implementation)
      feedService.ts     → News/feed data fetcher (CryptoPanic, CMC, etc.)
    types/
      index.ts           → Shared TypeScript types
docs/
  spec.md            → Feature specification
  plan.md            → Development plan (phased checklist)
  current-task.md    → Current task status
```

## Core Architecture Flow
1. App opens → Boot sequence animation plays
2. User sees COMMAND tab (News Feed | Canvas | Chat)
3. User types in ChatPanel → claude.ts sends to Claude API
4. Claude responds with tool_use calls (spawn_card, spawn_webview, etc.)
5. claude.ts parses tool calls → updates useCanvasStore
6. SpawnAnimation plays → cards/nodes appear on Canvas
7. Edges between related nodes (hidden by default, revealed on hover)
8. binanceWs.ts subscribes to symbols → real-time updates
9. Breaking news flows into left-side NewsFeed panel
10. User can drag news items onto canvas to create new nodes

## Claude API Tools (7 tools Claude can call)
- spawn_card(title, content, cardType?, size?, images?, symbol?, relatedTo?) → Create info card
- spawn_webview(url, title, size?) → Embed any website on canvas
- remove_cards(target) → Remove cards ("all" or card ID)
- rearrange(layout) → Rearrange cards ("grid" / "stack")
- update_card(cardId, content) → Update existing card content
- open_investigation(cardId) → Open Investigation Mode for a card
- search_web(query) → Search the web for current information via Tavily API

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