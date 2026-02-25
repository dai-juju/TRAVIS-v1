import { create } from 'zustand'
import type { FeedItem, FeedCategory, FeedImportance } from '../types'

interface FeedState {
  items: FeedItem[]
  filters: {
    categories: Set<FeedCategory>
    importance: Set<FeedImportance>
  }
  addItems: (newItems: FeedItem[]) => void
  updateScoring: (scores: Array<{ id: string; importance: FeedImportance; score: number }>) => void
  toggleCategoryFilter: (cat: FeedCategory) => void
  toggleImportanceFilter: (imp: FeedImportance) => void
  getFilteredItems: () => FeedItem[]
}

export const useFeedStore = create<FeedState>((set, get) => ({
  items: [],
  filters: {
    categories: new Set<FeedCategory>(),
    importance: new Set<FeedImportance>(),
  },

  addItems: (newItems) => {
    const { items } = get()
    // Map으로 중복 제거 (기존 + 신규, 신규가 덮어씀)
    const map = new Map<string, FeedItem>()
    for (const item of items) map.set(item.id, item)
    for (const item of newItems) map.set(item.id, item)

    const merged = Array.from(map.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 200)

    set({ items: merged })
  },

  updateScoring: (scores) => {
    const scoreMap = new Map(scores.map((s) => [s.id, s]))
    set((state) => ({
      items: state.items.map((item) => {
        const s = scoreMap.get(item.id)
        if (!s) return item
        return { ...item, aiImportance: s.importance, relevanceScore: s.score, scored: true }
      }),
    }))
  },

  toggleCategoryFilter: (cat) =>
    set((state) => {
      const next = new Set(state.filters.categories)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return { filters: { ...state.filters, categories: next } }
    }),

  toggleImportanceFilter: (imp) =>
    set((state) => {
      const next = new Set(state.filters.importance)
      if (next.has(imp)) next.delete(imp)
      else next.add(imp)
      return { filters: { ...state.filters, importance: next } }
    }),

  getFilteredItems: () => {
    const { items, filters } = get()
    return items.filter((item) => {
      if (filters.categories.size > 0 && !filters.categories.has(item.category)) return false
      if (filters.importance.size > 0 && !filters.importance.has(item.importance)) return false
      return true
    })
  },
}))
