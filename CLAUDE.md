# TRAVIS — Shape Your Market

## What is this
Electron desktop app. User types natural language in chat → Claude AI decides what to show → spawns info cards and websites on an infinite canvas with cinematic animations. Like JARVIS from Iron Man for crypto traders.

## Tech Stack
- Electron (app shell + webview for embedded sites)
- React + TypeScript (frontend)
- TailwindCSS (styling)
- Zustand (state management)
- Claude API with tool use (AI brain)
- Vite (bundler)
- WebSocket (Binance real-time price/volume/funding streams)
- Framer Motion or CSS animations (boot sequence + cinematic spawn)

## Project Structure
```
src/
  main/                → Electron main process (window, IPC, API key)
    index.ts           → App entry point
    ipc.ts             → Main↔Renderer communication bridge
  renderer/            → React frontend (what user sees)
    App.tsx            → Root layout: Boot → Canvas + ChatPanel
    components/
      BootSequence.tsx     → App startup cinematic animation
      Canvas.tsx           → Infinite canvas where cards live
      ChatPanel.tsx        → Right-side chat panel
      Card.tsx             → Single info card (AI-generated content, supports images/charts)
      WebviewCard.tsx      → Embedded website card
      InvestigationMode.tsx → Full-screen 6-panel analysis grid
      SpawnAnimation.tsx   → Cinematic card spawn effects (glow → expand → content)
      LatencyIndicator.tsx → Real-time data delay indicator per card
    stores/
      useCanvasStore.ts    → Cards list, positions, zoom level
      useChatStore.ts      → Chat messages history
      useSettingsStore.ts  → User settings (context prompt, API key)
      useRealtimeStore.ts  → WebSocket connection state, live price data
    services/
      claude.ts          → Claude API call + tool use response parser
      binanceWs.ts       → Binance WebSocket manager (subscribe/unsubscribe symbols)
      binanceRest.ts     → Binance REST API for initial data fetch
    types/
      index.ts           → Shared TypeScript types
docs/
  spec.md            → Feature specification
  plan.md            → Development plan (phased checklist)
  current-task.md    → Current task status
```

## Core Architecture Flow
1. App opens → Boot sequence animation plays
2. User types in ChatPanel
3. ChatPanel calls claude.ts with message + chat history
4. claude.ts sends to Claude API (system prompt + tools + messages)
5. Claude responds with tool_use calls (spawn_card, spawn_webview, etc.)
6. claude.ts parses tool calls → updates useCanvasStore
7. SpawnAnimation plays cinematic effect → cards appear on Canvas
8. binanceWs.ts subscribes to relevant symbols → cards update in real-time
9. LatencyIndicator shows data freshness on each card header

## Claude API Tools (6 tools Claude can call)
- spawn_card(title, content, cardType?, size?, images?) → Create info card with optional images/charts
- spawn_webview(url, title, size?) → Embed any website on canvas
- remove_cards(target) → Remove cards ("all" or card ID)
- rearrange(layout) → Rearrange cards ("grid" / "stack")
- update_card(cardId, content) → Update existing card content
- open_investigation(cardId) → Open Investigation Mode for a card

## Development Rules
- Read docs/plan.md FIRST before writing any code
- Implement ONE phase at a time
- Follow the project structure above when creating files
- When modifying existing code, explain impact scope first
- Include error messages when reporting issues
- Write code in English, comments can be Korean
- Test each phase before moving to the next

## Commands
- npm run dev → Start dev server (Electron + Vite)
- npm run build → Production build

## Current Task
Read docs/current-task.md for current status.