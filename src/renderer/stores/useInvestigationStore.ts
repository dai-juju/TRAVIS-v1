import { create } from 'zustand'
import type { CardData } from '../types'
import { useCanvasStore } from './useCanvasStore'
import { useRealtimeStore } from './useRealtimeStore'

const api = (window as unknown as { api: Record<string, (...args: unknown[]) => Promise<unknown>> }).api

export type PanelType = 'markdown' | 'chart' | 'news' | 'whale' | 'onchain' | 'sector'

export interface PanelState {
  id: string
  title: string
  content: string
  tag: 'STREAM' | 'CLAUDE' | 'LOCAL'
  panelType: PanelType
  isMaximized: boolean
  isFolded: boolean
  isLoading?: boolean
  error?: string | null
  data?: unknown
}

interface InvestigationState {
  isOpen: boolean
  targetCard: CardData | null
  panels: PanelState[]
  open: (card: CardData) => void
  close: () => void
  toggleMaximize: (panelId: string) => void
  toggleFold: (panelId: string) => void
  updatePanel: (panelId: string, partial: Partial<PanelState>) => void
}

// Sector mappings
const SECTOR_MAP: Record<string, { name: string; symbols: string[] }> = {
  BTC: { name: 'Store of Value', symbols: ['BTC', 'LTC', 'BCH'] },
  LTC: { name: 'Store of Value', symbols: ['BTC', 'LTC', 'BCH'] },
  BCH: { name: 'Store of Value', symbols: ['BTC', 'LTC', 'BCH'] },
  ETH: { name: 'Smart Contract', symbols: ['ETH', 'SOL', 'ADA', 'DOT', 'AVAX', 'MATIC'] },
  SOL: { name: 'Smart Contract', symbols: ['ETH', 'SOL', 'ADA', 'DOT', 'AVAX', 'MATIC'] },
  ADA: { name: 'Smart Contract', symbols: ['ETH', 'SOL', 'ADA', 'DOT', 'AVAX', 'MATIC'] },
  DOT: { name: 'Smart Contract', symbols: ['ETH', 'SOL', 'ADA', 'DOT', 'AVAX', 'MATIC'] },
  AVAX: { name: 'Smart Contract', symbols: ['ETH', 'SOL', 'ADA', 'DOT', 'AVAX', 'MATIC'] },
  MATIC: { name: 'Smart Contract', symbols: ['ETH', 'SOL', 'ADA', 'DOT', 'AVAX', 'MATIC'] },
  UNI: { name: 'DeFi', symbols: ['UNI', 'AAVE', 'LINK', 'MKR'] },
  AAVE: { name: 'DeFi', symbols: ['UNI', 'AAVE', 'LINK', 'MKR'] },
  LINK: { name: 'DeFi', symbols: ['UNI', 'AAVE', 'LINK', 'MKR'] },
  MKR: { name: 'DeFi', symbols: ['UNI', 'AAVE', 'LINK', 'MKR'] },
  BNB: { name: 'Exchange', symbols: ['BNB', 'CRO', 'OKB'] },
  CRO: { name: 'Exchange', symbols: ['BNB', 'CRO', 'OKB'] },
  OKB: { name: 'Exchange', symbols: ['BNB', 'CRO', 'OKB'] },
  DOGE: { name: 'Meme', symbols: ['DOGE', 'SHIB', 'PEPE'] },
  SHIB: { name: 'Meme', symbols: ['DOGE', 'SHIB', 'PEPE'] },
  PEPE: { name: 'Meme', symbols: ['DOGE', 'SHIB', 'PEPE'] },
  ARB: { name: 'L2', symbols: ['ARB', 'OP'] },
  OP: { name: 'L2', symbols: ['ARB', 'OP'] },
}

// CoinGecko ID mapping (renderer side)
const SYMBOL_TO_COINGECKO: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  BNB: 'binancecoin',
  XRP: 'ripple',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  DOT: 'polkadot',
  AVAX: 'avalanche-2',
  MATIC: 'matic-network',
  LINK: 'chainlink',
  UNI: 'uniswap',
  LTC: 'litecoin',
  BCH: 'bitcoin-cash',
  SHIB: 'shiba-inu',
  PEPE: 'pepe',
  ARB: 'arbitrum',
  OP: 'optimism',
  AAVE: 'aave',
  MKR: 'maker',
  CRO: 'crypto-com-chain',
  OKB: 'okb',
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

  const sectorInfo = SECTOR_MAP[symbol]
  const sectorTitle = sectorInfo ? `Sector: ${sectorInfo.name}` : 'Sector Compare'

  return [
    { id: 'overview', title: 'Overview', content: overviewContent, tag: 'STREAM', panelType: 'markdown', isMaximized: false, isFolded: false },
    { id: 'chart', title: 'Chart', content: '', tag: 'LOCAL', panelType: 'chart', isMaximized: false, isFolded: false, isLoading: true },
    { id: 'news', title: 'News', content: '', tag: 'CLAUDE', panelType: 'news', isMaximized: false, isFolded: false },
    { id: 'whale', title: 'Whale Activity', content: '', tag: 'STREAM', panelType: 'whale', isMaximized: false, isFolded: false, isLoading: true },
    { id: 'onchain', title: 'On-chain Data', content: '', tag: 'LOCAL', panelType: 'onchain', isMaximized: false, isFolded: false, isLoading: true },
    { id: 'sector', title: sectorTitle, content: '', tag: 'LOCAL', panelType: 'sector', isMaximized: false, isFolded: false, isLoading: true },
  ]
}

function buildGenericPanels(card: CardData): PanelState[] {
  const panels: PanelState[] = [
    { id: 'main', title: card.title, content: card.content, tag: 'LOCAL', panelType: 'markdown', isMaximized: false, isFolded: false },
  ]

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
      panelType: 'markdown',
      isMaximized: false,
      isFolded: false,
    })
  }

  while (panels.length < 6) {
    panels.push({
      id: `empty-${panels.length}`,
      title: `Panel ${panels.length + 1}`,
      content: '*No additional data available.*',
      tag: 'LOCAL',
      panelType: 'markdown',
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

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms)),
  ])
}

async function loadPanelData(symbol: string) {
  const store = useInvestigationStore.getState()
  const coinId = SYMBOL_TO_COINGECKO[symbol] ?? null
  const sectorInfo = SECTOR_MAP[symbol]
  const TIMEOUT = 8000

  try {
    const [klinesResult, tradesResult, coinResult, sectorResult] = await Promise.allSettled([
      withTimeout(api.fetchKlines(symbol, '1h', 100) as Promise<unknown>, TIMEOUT),
      withTimeout(api.fetchRecentTrades(symbol, 500) as Promise<unknown>, TIMEOUT),
      coinId
        ? withTimeout(api.fetchCoinData(coinId) as Promise<unknown>, TIMEOUT)
        : Promise.reject(new Error('Unknown coin')),
      sectorInfo
        ? withTimeout(api.fetchMultipleTickers(sectorInfo.symbols) as Promise<unknown>, TIMEOUT)
        : Promise.reject(new Error('No sector data')),
    ])

    // Chart panel
    if (klinesResult.status === 'fulfilled') {
      store.updatePanel('chart', { data: { klines: klinesResult.value }, isLoading: false, error: null })
    } else {
      store.updatePanel('chart', { isLoading: false, error: `Data unavailable for ${symbol}` })
    }

    // Whale panel - filter trades >= $100K
    if (tradesResult.status === 'fulfilled') {
      const allTrades = tradesResult.value as Array<{ quoteQty: string; [key: string]: unknown }>
      const whaleTrades = allTrades.filter((t) => parseFloat(t.quoteQty) >= 100000)
      store.updatePanel('whale', { data: { trades: whaleTrades }, isLoading: false, error: null })
    } else {
      store.updatePanel('whale', { isLoading: false, error: `Data unavailable for ${symbol}` })
    }

    // On-chain panel
    if (coinResult.status === 'fulfilled') {
      store.updatePanel('onchain', { data: coinResult.value, isLoading: false, error: null })
    } else {
      store.updatePanel('onchain', { isLoading: false, error: coinId ? `Failed to load on-chain data` : `No CoinGecko data for ${symbol}` })
    }

    // Sector panel
    if (sectorResult.status === 'fulfilled') {
      store.updatePanel('sector', {
        data: { tickers: sectorResult.value, sectorName: sectorInfo?.name, symbols: sectorInfo?.symbols },
        isLoading: false,
        error: null,
      })
    } else {
      store.updatePanel('sector', { isLoading: false, error: sectorInfo ? 'Failed to load sector data' : `No sector mapping for ${symbol}` })
    }
  } catch {
    // Unexpected error — clear all loading states
    for (const id of ['chart', 'whale', 'onchain', 'sector']) {
      const panel = useInvestigationStore.getState().panels.find((p) => p.id === id)
      if (panel?.isLoading) {
        store.updatePanel(id, { isLoading: false, error: `Data unavailable for ${symbol}` })
      }
    }
  }
}

export const useInvestigationStore = create<InvestigationState>((set) => ({
  isOpen: false,
  targetCard: null,
  panels: [],

  open: (card) => {
    const panels = card.symbol ? buildCoinPanels(card) : buildGenericPanels(card)
    set({ isOpen: true, targetCard: card, panels })
    if (card.symbol) {
      loadPanelData(card.symbol.toUpperCase())
    }
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

  updatePanel: (panelId, partial) =>
    set((state) => ({
      panels: state.panels.map((p) =>
        p.id === panelId ? { ...p, ...partial } : p
      ),
    })),
}))
