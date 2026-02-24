import { create } from 'zustand'
import type { CardData } from '../types'
import { useCanvasStore } from './useCanvasStore'
import { useRealtimeStore } from './useRealtimeStore'

export interface PanelState {
  id: string
  title: string
  content: string
  tag: 'STREAM' | 'CLAUDE' | 'LOCAL'
  isMaximized: boolean
  isFolded: boolean
}

interface InvestigationState {
  isOpen: boolean
  targetCard: CardData | null
  panels: PanelState[]
  open: (card: CardData) => void
  close: () => void
  toggleMaximize: (panelId: string) => void
  toggleFold: (panelId: string) => void
}

function buildCoinPanels(card: CardData): PanelState[] {
  const symbol = card.symbol?.toUpperCase() || ''
  const ticker = useRealtimeStore.getState().tickers[symbol]

  let overviewContent = `## ${card.title}\n\n`
  if (ticker) {
    const direction = ticker.change24h >= 0 ? '📈' : '📉'
    overviewContent += `**Price**: $${ticker.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}\n\n`
    overviewContent += `**24h Change**: ${direction} ${ticker.change24h >= 0 ? '+' : ''}${ticker.change24h.toFixed(2)}%\n\n`
    overviewContent += `**24h Volume**: ${formatVolume(ticker.volume24h)}\n\n`
    overviewContent += `**24h High**: $${ticker.high24h.toLocaleString()}\n\n`
    overviewContent += `**24h Low**: $${ticker.low24h.toLocaleString()}\n\n`
    overviewContent += `---\n\n`
  }
  overviewContent += card.content

  return [
    { id: 'overview', title: 'Overview', content: overviewContent, tag: 'STREAM', isMaximized: false, isFolded: false },
    { id: 'chart', title: 'Chart', content: `## ${symbol} Chart\n\n*Chart integration coming in Phase 2.*\n\nTradingView or lightweight-charts will be embedded here for candlestick charts with technical indicators.`, tag: 'LOCAL', isMaximized: false, isFolded: false },
    { id: 'news', title: 'News', content: `## Latest News\n\n*AI-powered news analysis coming in Phase 2.*\n\nThis panel will display the latest news articles related to ${symbol}, analyzed and summarized by AI.`, tag: 'CLAUDE', isMaximized: false, isFolded: false },
    { id: 'whale', title: 'Whale Activity', content: `## Whale Transactions\n\n*Whale tracking coming in Phase 2.*\n\nThis panel will show recent large transactions and wallet movements for ${symbol}.`, tag: 'CLAUDE', isMaximized: false, isFolded: false },
    { id: 'onchain', title: 'On-chain / Unlocks', content: `## On-chain Data\n\n*On-chain analytics coming in Phase 2.*\n\nToken unlock schedule, active addresses, and exchange inflow/outflow data for ${symbol} will appear here.`, tag: 'CLAUDE', isMaximized: false, isFolded: false },
    { id: 'sector', title: 'Sector Compare', content: `## Sector Comparison\n\n*Sector analysis coming in Phase 2.*\n\nThis panel will compare ${symbol} with other coins in the same sector.`, tag: 'CLAUDE', isMaximized: false, isFolded: false },
  ]
}

function buildGenericPanels(card: CardData): PanelState[] {
  const panels: PanelState[] = [
    { id: 'main', title: card.title, content: card.content, tag: 'LOCAL', isMaximized: false, isFolded: false },
  ]

  // 캔버스의 다른 카드들을 cross-reference로 추가
  const allCards = useCanvasStore.getState().cards.filter(
    (c) => c.id !== card.id && c.type === 'card'
  ) as CardData[]

  const crossRefCards = allCards.slice(0, 5)
  for (const refCard of crossRefCards) {
    panels.push({
      id: refCard.id,
      title: refCard.title,
      content: refCard.content,
      tag: 'LOCAL',
      isMaximized: false,
      isFolded: false,
    })
  }

  // 6개 패널 채우기
  while (panels.length < 6) {
    panels.push({
      id: `empty-${panels.length}`,
      title: `Panel ${panels.length + 1}`,
      content: '*No additional data available.*',
      tag: 'LOCAL',
      isMaximized: false,
      isFolded: false,
    })
  }

  return panels.slice(0, 6)
}

function formatVolume(vol: number): string {
  if (vol >= 1e9) return '$' + (vol / 1e9).toFixed(2) + 'B'
  if (vol >= 1e6) return '$' + (vol / 1e6).toFixed(2) + 'M'
  if (vol >= 1e3) return '$' + (vol / 1e3).toFixed(1) + 'K'
  return '$' + vol.toFixed(0)
}

export const useInvestigationStore = create<InvestigationState>((set) => ({
  isOpen: false,
  targetCard: null,
  panels: [],

  open: (card) => {
    const panels = card.symbol ? buildCoinPanels(card) : buildGenericPanels(card)
    set({ isOpen: true, targetCard: card, panels })
  },

  close: () => set({ isOpen: false }),

  toggleMaximize: (panelId) =>
    set((state) => ({
      panels: state.panels.map((p) =>
        p.id === panelId
          ? { ...p, isMaximized: !p.isMaximized, isFolded: false }
          : { ...p, isMaximized: false }
      ),
    })),

  toggleFold: (panelId) =>
    set((state) => ({
      panels: state.panels.map((p) =>
        p.id === panelId
          ? { ...p, isFolded: !p.isFolded, isMaximized: false }
          : p
      ),
    })),
}))
