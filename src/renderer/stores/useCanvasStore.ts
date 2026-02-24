import { create } from 'zustand'
import type { CanvasItem, CardData, WebviewData } from '../types'

interface Viewport {
  x: number
  y: number
  zoom: number
}

interface CanvasState {
  cards: CanvasItem[]
  viewport: Viewport
  setViewport: (viewport: Partial<Viewport>) => void
  resetViewport: () => void
  addCard: (card: Omit<CardData, 'id' | 'x' | 'y'> & { id?: string; x?: number; y?: number }) => string
  addWebview: (card: Omit<WebviewData, 'id' | 'x' | 'y'> & { id?: string; x?: number; y?: number }) => string
  removeCard: (id: string) => void
  removeAllCards: () => void
  updateCardPosition: (id: string, x: number, y: number) => void
  updateCardSize: (id: string, width: number, height: number) => void
  updateCardContent: (id: string, content: string) => void
  rearrangeCards: (layout: 'grid' | 'stack') => void
}

const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 }

const CARD_GAP = 24
const ROW_WRAP_WIDTH = 1400

// 마지막 카드 위치 기반으로 새 카드 위치 계산
function calculateNextPosition(cards: CanvasItem[], width: number, height: number): { x: number; y: number } {
  if (cards.length === 0) {
    return { x: 80, y: 80 }
  }

  // 가장 오른쪽 카드 기준
  const lastCard = cards[cards.length - 1]
  const nextX = lastCard.x + lastCard.width + CARD_GAP

  // 줄바꿈 필요 시
  if (nextX + width > ROW_WRAP_WIDTH) {
    // 가장 아래쪽 카드의 y + height 기준으로 새 행
    const maxBottom = Math.max(...cards.map((c) => c.y + c.height))
    return { x: 80, y: maxBottom + CARD_GAP }
  }

  return { x: nextX, y: lastCard.y }
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  cards: [],
  viewport: { ...DEFAULT_VIEWPORT },

  setViewport: (update) =>
    set((state) => ({
      viewport: { ...state.viewport, ...update },
    })),

  resetViewport: () => set({ viewport: { ...DEFAULT_VIEWPORT } }),

  addCard: (cardInput) => {
    const id = cardInput.id || crypto.randomUUID()
    const width = cardInput.width || 380
    const height = cardInput.height || 280
    const { cards } = get()
    const pos = cardInput.x !== undefined && cardInput.y !== undefined
      ? { x: cardInput.x, y: cardInput.y }
      : calculateNextPosition(cards, width, height)

    const card: CardData = {
      id,
      type: 'card',
      title: cardInput.title,
      content: cardInput.content,
      cardType: cardInput.cardType,
      symbol: cardInput.symbol,
      images: cardInput.images,
      width,
      height,
      spawnDelay: cardInput.spawnDelay,
      ...pos,
    }

    set((state) => ({ cards: [...state.cards, card] }))
    return id
  },

  addWebview: (webInput) => {
    const id = webInput.id || crypto.randomUUID()
    const width = webInput.width || 900
    const height = webInput.height || 700
    const { cards } = get()
    const pos = webInput.x !== undefined && webInput.y !== undefined
      ? { x: webInput.x, y: webInput.y }
      : calculateNextPosition(cards, width, height)

    const webview: WebviewData = {
      id,
      type: 'webview',
      url: webInput.url,
      title: webInput.title,
      width,
      height,
      ...pos,
    }

    set((state) => ({ cards: [...state.cards, webview] }))
    return id
  },

  removeCard: (id) =>
    set((state) => ({
      cards: state.cards.filter((c) => c.id !== id),
    })),

  removeAllCards: () => set({ cards: [] }),

  updateCardPosition: (id, x, y) =>
    set((state) => ({
      cards: state.cards.map((c) => (c.id === id ? { ...c, x, y } : c)),
    })),

  updateCardSize: (id, width, height) =>
    set((state) => ({
      cards: state.cards.map((c) => (c.id === id ? { ...c, width, height } : c)),
    })),

  updateCardContent: (id, content) =>
    set((state) => ({
      cards: state.cards.map((c) =>
        c.id === id && c.type === 'card' ? { ...c, content } : c
      ),
    })),

  rearrangeCards: (layout) =>
    set((state) => {
      const { cards } = state
      if (cards.length === 0) return state

      if (layout === 'grid') {
        const cols = 3
        return {
          cards: cards.map((card, i) => ({
            ...card,
            x: 80 + (i % cols) * (card.width + CARD_GAP),
            y: 80 + Math.floor(i / cols) * (card.height + CARD_GAP),
          })),
        }
      }

      // stack: 카드들을 세로로 정렬
      let currentY = 80
      return {
        cards: cards.map((card) => {
          const y = currentY
          currentY += card.height + CARD_GAP
          return { ...card, x: 80, y }
        }),
      }
    }),
}))
