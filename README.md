# TRAVIS — Shape Your Market

AI-powered cryptocurrency market analysis desktop app. Chat naturally with an AI that spawns interactive information cards on an infinite canvas — like JARVIS for crypto traders.

## Screenshots

> Screenshots coming soon

## Features

- **Cinematic Boot Sequence** — Orbital ring animation with system status messages on startup
- **AI Chat** — Natural language conversation powered by Claude API with multi-turn tool use
- **Card Spawning** — AI decides what to show and spawns markdown info cards on the canvas
- **Cinematic Spawn Animation** — Cards appear with glow, scale, and cascade effects
- **Infinite Canvas** — Pan by dragging, zoom with mouse wheel, dot grid background
- **Draggable & Resizable Cards** — Drag cards by header, resize from corner handle, close with X
- **Markdown Rendering** — Cards support full markdown: tables, code blocks, lists, blockquotes, links
- **Card Type Styling** — Different accent colors for analysis, price, news, data, comparison, summary
- **Smart Placement** — New cards auto-position to the right of existing cards, wrapping to next row
- **Settings** — Configure API key, Claude model, and custom context prompt

### Example

```
User: "BTC 분석해줘"
→ AI spawns 2-3 cards with market analysis, technical indicators, and news summary
```

## Roadmap

| Phase | Feature | Status |
|-------|---------|--------|
| 1-1 | Project Setup | Done |
| 1-2 | Boot Sequence | Done |
| 1-3 | Canvas + Chat Layout | Done |
| 1-4 | Claude API Integration | Done |
| 1-5 | Card Rendering + Cinematic Spawn | Done |
| 1-6 | Webview Rendering (embedded websites) | Planned |
| 1-7 | Real-Time Data (Binance WebSocket + latency) | Planned |
| 1-8 | Investigation Mode (6-panel analysis grid) | Planned |

## Tech Stack

- **Electron** — Desktop app shell
- **React 18** — UI framework
- **TypeScript** — Type safety
- **Claude API** — AI brain with tool use
- **Zustand** — State management
- **Framer Motion** — Animations
- **TailwindCSS** — Styling
- **Vite** — Bundler

## Getting Started

```bash
git clone https://github.com/dai-juju/TRAVIS-v1.git
cd TRAVIS-v1
npm install
npm run dev
```

On first launch, click the gear icon (⚙) in the chat panel header to open Settings and enter your **Claude API Key**. The key is stored locally and only sent to the Anthropic API.

## Scripts

```bash
npm run dev    # Start dev server (Electron + Vite)
npm run build  # Production build
```

## License

MIT
