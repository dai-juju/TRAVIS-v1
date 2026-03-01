// Zustand — 상태 관리 라이브러리
import { create } from 'zustand'
// 뉴스피드 관련 타입 정의 가져오기
import type { FeedItem, FeedCategory, FeedImportance } from '../types'

// 뉴스 피드 저장소의 전체 상태와 기능 정의
interface FeedState {
  items: FeedItem[]                     // 전체 뉴스/피드 아이템 목록
  filters: {
    categories: Set<FeedCategory>       // 활성화된 카테고리 필터 (예: crypto, macro)
    importance: Set<FeedImportance>     // 활성화된 중요도 필터 (예: critical, alert)
  }
  addItems: (newItems: FeedItem[]) => void        // 새 뉴스 아이템 추가
  updateScoring: (scores: Array<{ id: string; importance: FeedImportance; score: number }>) => void  // AI 점수 반영
  toggleCategoryFilter: (cat: FeedCategory) => void      // 카테고리 필터 켜기/끄기
  toggleImportanceFilter: (imp: FeedImportance) => void   // 중요도 필터 켜기/끄기
  getFilteredItems: () => FeedItem[]                      // 필터 적용된 뉴스 목록 조회
}

// ====================================================================
// 뉴스 피드 저장소 — 실시간으로 들어오는 뉴스/이벤트를 관리하는 중앙 금고
// 뉴스가 들어올 때마다 여기에 저장되고, 사용자 필터에 맞게 표시됨
// ====================================================================
export const useFeedStore = create<FeedState>((set, get) => ({
  items: [],                // 처음엔 뉴스가 비어있음
  filters: {
    categories: new Set<FeedCategory>(),    // 기본값: 모든 카테고리 표시 (필터 없음)
    importance: new Set<FeedImportance>(),   // 기본값: 모든 중요도 표시
  },

  // 새 뉴스 아이템을 기존 목록에 병합하는 함수
  // 같은 ID의 뉴스가 있으면 새 것으로 덮어쓰고, 최신순 정렬 후 최대 200개만 유지
  addItems: (newItems) => {
    const { items } = get()
    // Map을 사용해 중복 제거 — 같은 ID면 신규 아이템이 기존 것을 덮어씀
    const map = new Map<string, FeedItem>()
    for (const item of items) map.set(item.id, item)
    for (const item of newItems) map.set(item.id, item)

    // 최신순으로 정렬하고, 메모리 절약을 위해 최대 200개만 보관
    const merged = Array.from(map.values())
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 200)

    set({ items: merged })
  },

  // AI가 뉴스 중요도를 평가한 결과를 반영하는 함수
  // AI 스코어링 서비스가 각 뉴스의 중요도(critical/alert/signal/info)와 관련성 점수(0-100)를 매김
  updateScoring: (scores) => {
    const scoreMap = new Map(scores.map((s) => [s.id, s]))
    set((state) => ({
      items: state.items.map((item) => {
        const s = scoreMap.get(item.id)
        if (!s) return item  // 해당 뉴스에 대한 점수가 없으면 그대로 유지
        // AI가 평가한 중요도와 점수를 뉴스 아이템에 추가
        return { ...item, aiImportance: s.importance, relevanceScore: s.score, scored: true }
      }),
    }))
  },

  // 카테고리 필터 토글 — 해당 카테고리가 이미 선택되어 있으면 해제, 아니면 선택
  toggleCategoryFilter: (cat) =>
    set((state) => {
      const next = new Set(state.filters.categories)
      if (next.has(cat)) next.delete(cat)  // 이미 켜져 있으면 끄기
      else next.add(cat)                    // 꺼져 있으면 켜기
      return { filters: { ...state.filters, categories: next } }
    }),

  // 중요도 필터 토글 — 해당 중요도가 이미 선택되어 있으면 해제, 아니면 선택
  toggleImportanceFilter: (imp) =>
    set((state) => {
      const next = new Set(state.filters.importance)
      if (next.has(imp)) next.delete(imp)
      else next.add(imp)
      return { filters: { ...state.filters, importance: next } }
    }),

  // 현재 필터 설정에 맞는 뉴스 아이템만 반환하는 함수
  // 필터가 비어있으면 (아무것도 선택 안 했으면) 전체 표시
  getFilteredItems: () => {
    const { items, filters } = get()
    return items.filter((item) => {
      // 카테고리 필터가 설정되어 있는데 해당 뉴스의 카테고리가 포함 안 되면 제외
      if (filters.categories.size > 0 && !filters.categories.has(item.category)) return false
      // 중요도 필터가 설정되어 있는데 해당 뉴스의 중요도가 포함 안 되면 제외
      if (filters.importance.size > 0 && !filters.importance.has(item.importance)) return false
      return true  // 모든 필터 통과 → 표시
    })
  },
}))
