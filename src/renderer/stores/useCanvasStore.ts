// Zustand — 상태 관리 라이브러리 (React용 전역 저장소 역할)
import { create } from 'zustand'
// 캔버스에서 사용하는 데이터 타입 정의 가져오기
import type { CanvasItem, CardData, WebviewData, EdgeData, EdgeStrength } from '../types'

// 뷰포트: 사용자가 캔버스를 얼마나 이동(x,y)하고 확대/축소(zoom)했는지를 나타냄
interface Viewport {
  x: number      // 좌우 이동 위치
  y: number      // 상하 이동 위치
  zoom: number   // 확대/축소 배율 (1 = 기본크기)
}

// 캔버스 저장소의 전체 상태와 기능 목록 정의
interface CanvasState {
  cards: CanvasItem[]             // 캔버스 위에 있는 모든 카드와 웹뷰 목록
  edges: EdgeData[]               // 카드 간 연결선 목록
  hoveredNodeId: string | null    // 현재 마우스가 올려진 카드 ID
  pinnedNodeIds: string[]         // 고정된(핀된) 카드 ID 목록
  showAllEdges: boolean           // 모든 연결선을 항상 표시할지 여부
  viewport: Viewport              // 현재 캔버스 화면 위치/줌 상태
  setViewport: (viewport: Partial<Viewport>) => void        // 뷰포트(화면 위치) 변경
  resetViewport: () => void                                   // 뷰포트를 초기 위치로 리셋
  addCard: (card: Omit<CardData, 'id' | 'x' | 'y'> & { id?: string; x?: number; y?: number }) => string    // 정보 카드 추가
  addWebview: (card: Omit<WebviewData, 'id' | 'x' | 'y'> & { id?: string; x?: number; y?: number }) => string  // 웹사이트 카드 추가
  removeCard: (id: string) => void               // 특정 카드 삭제
  removeAllCards: () => void                      // 모든 카드 일괄 삭제
  updateCardPosition: (id: string, x: number, y: number) => void       // 카드 위치(드래그) 업데이트
  updateCardSize: (id: string, width: number, height: number) => void   // 카드 크기 변경
  updateCardContent: (id: string, content: string) => void              // 카드 내용 업데이트
  updateCard: (id: string, updates: Partial<CardData>) => void           // 카드 필드 업데이트 (스켈레톤→실제 전환 등)
  updateWebviewUrl: (id: string, url: string) => void                          // 웹뷰의 소스 URL 변경 (네비게이션)
  updateWebviewMeta: (id: string, liveTitle: string, liveUrl: string) => void  // 웹뷰의 현재 제목/URL 업데이트
  rearrangeCards: (layout: 'grid' | 'stack') => void    // 카드 배치 정렬 (격자형 또는 세로형)
  addEdge: (from: string, to: string, strength: EdgeStrength, label?: string) => void  // 카드 간 연결선 추가
  removeEdge: (id: string) => void               // 연결선 삭제
  setHoveredNode: (id: string | null) => void    // 마우스 올린 카드 설정
  togglePinNode: (id: string) => void            // 카드 고정/해제 토글
  clearPins: () => void                          // 모든 고정 해제
  toggleShowAllEdges: () => void                 // 연결선 전체 표시 토글
}

// 기본 뷰포트 상태 — 처음 화면을 열었을 때의 위치와 줌
const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 }

// 카드 간 간격 (px 단위)
const CARD_GAP = 24
// 이 너비를 넘으면 다음 줄로 카드를 배치 (자동 줄바꿈)
const ROW_WRAP_WIDTH = 1400

// 새 카드가 생성될 때 어디에 놓을지 자동 계산하는 함수
// 마지막 카드 옆에 놓되, 화면 오른쪽 끝을 넘으면 다음 줄로 내려감
function calculateNextPosition(cards: CanvasItem[], width: number, height: number): { x: number; y: number } {
  // 캔버스가 비어있으면 좌상단(80, 80)부터 시작
  if (cards.length === 0) {
    return { x: 80, y: 80 }
  }

  // 가장 마지막에 추가된 카드의 오른쪽에 배치 시도
  const lastCard = cards[cards.length - 1]
  const nextX = lastCard.x + lastCard.width + CARD_GAP

  // 오른쪽에 놓으면 화면을 넘어가는 경우 → 다음 줄(아래)로 이동
  if (nextX + width > ROW_WRAP_WIDTH) {
    // 모든 카드 중 가장 아래쪽 끝점을 찾아서 그 아래에 배치
    const maxBottom = Math.max(...cards.map((c) => c.y + c.height))
    return { x: 80, y: maxBottom + CARD_GAP }
  }

  // 같은 줄의 오른쪽에 배치
  return { x: nextX, y: lastCard.y }
}

// ====================================================================
// 캔버스 저장소 — 캔버스 위의 모든 카드, 연결선, 뷰포트를 관리하는 중앙 금고
// AI가 카드를 생성하거나 사용자가 드래그할 때 이 저장소가 업데이트됨
// ====================================================================
export const useCanvasStore = create<CanvasState>((set, get) => ({
  cards: [],                    // 현재 캔버스 위의 카드 목록 (처음엔 비어있음)
  edges: [],                    // 카드 간 연결선 목록
  hoveredNodeId: null,          // 마우스가 올려진 카드 없음
  pinnedNodeIds: [],            // 고정된 카드 없음
  showAllEdges: false,          // 연결선은 기본적으로 숨김 (마우스 올려야 보임)
  viewport: { ...DEFAULT_VIEWPORT },  // 초기 화면 위치

  // 뷰포트(화면 위치/줌) 업데이트 — 사용자가 캔버스를 드래그하거나 줌할 때 호출됨
  setViewport: (update) =>
    set((state) => ({
      viewport: { ...state.viewport, ...update },
    })),

  // 뷰포트를 처음 상태(원점, 줌100%)로 리셋
  resetViewport: () => set({ viewport: { ...DEFAULT_VIEWPORT } }),

  // 정보 카드를 캔버스에 추가하는 함수 — AI가 spawn_card 도구를 호출하면 실행됨
  addCard: (cardInput) => {
    // 카드 고유 ID 생성 (없으면 랜덤 생성)
    const id = cardInput.id || crypto.randomUUID()
    const width = cardInput.width || 380    // 기본 너비 380px
    const height = cardInput.height || 280  // 기본 높이 280px
    const { cards } = get()
    // 위치가 지정되어 있으면 그 위치에, 아니면 자동 계산된 위치에 배치
    const pos = cardInput.x !== undefined && cardInput.y !== undefined
      ? { x: cardInput.x, y: cardInput.y }
      : calculateNextPosition(cards, width, height)

    // 카드 데이터 객체 구성
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
      isLoading: cardInput.isLoading,
      ...pos,
    }

    // 기존 카드 목록 끝에 새 카드를 추가
    set((state) => ({ cards: [...state.cards, card] }))
    return id  // 생성된 카드의 ID를 반환 (다른 카드와 연결할 때 사용)
  },

  // 웹사이트(웹뷰) 카드를 캔버스에 추가 — AI가 spawn_webview 도구를 호출하면 실행됨
  addWebview: (webInput) => {
    const id = webInput.id || crypto.randomUUID()
    const width = webInput.width || 900     // 웹뷰 기본 너비 900px (일반 카드보다 큼)
    const height = webInput.height || 700   // 웹뷰 기본 높이 700px
    const { cards } = get()
    // 위치 지정 없으면 자동 계산
    const pos = webInput.x !== undefined && webInput.y !== undefined
      ? { x: webInput.x, y: webInput.y }
      : calculateNextPosition(cards, width, height)

    // 웹뷰 데이터 객체 구성
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

  // 특정 카드 1개 삭제 — 해당 카드와 연결된 연결선, 고정 상태도 함께 제거
  removeCard: (id) =>
    set((state) => ({
      cards: state.cards.filter((c) => c.id !== id),
      edges: state.edges.filter((e) => e.fromNodeId !== id && e.toNodeId !== id),
      pinnedNodeIds: state.pinnedNodeIds.filter((nid) => nid !== id),
    })),

  // 캔버스 전체 초기화 — 모든 카드, 연결선, 고정 해제
  removeAllCards: () => set({ cards: [], edges: [], pinnedNodeIds: [], hoveredNodeId: null }),

  // 카드 위치 업데이트 — 사용자가 카드를 드래그할 때 호출됨
  updateCardPosition: (id, x, y) =>
    set((state) => ({
      cards: state.cards.map((c) => (c.id === id ? { ...c, x, y } : c)),
    })),

  // 카드 크기 변경 — 리사이즈할 때 호출됨
  updateCardSize: (id, width, height) =>
    set((state) => ({
      cards: state.cards.map((c) => (c.id === id ? { ...c, width, height } : c)),
    })),

  // 카드 내용(텍스트) 업데이트 — AI가 update_card 도구를 호출하면 실행됨
  updateCardContent: (id, content) =>
    set((state) => ({
      cards: state.cards.map((c) =>
        c.id === id && c.type === 'card' ? { ...c, content } : c
      ),
    })),

  // 카드 필드를 부분 업데이트 — 스켈레톤 상태에서 실제 콘텐츠로 전환할 때 사용
  updateCard: (id, updates) =>
    set((state) => ({
      cards: state.cards.map((c) =>
        c.id === id && c.type === 'card' ? { ...c, ...updates } : c
      ),
    })),

  // 웹뷰의 소스 URL을 변경 — AI가 control_webview 도구로 네비게이션할 때 호출됨
  updateWebviewUrl: (id, url) =>
    set((state) => ({
      cards: state.cards.map((c) =>
        c.id === id && c.type === 'webview' ? { ...c, url } : c
      ),
    })),

  // 웹뷰의 현재 페이지 제목과 URL 업데이트 — 웹뷰 내에서 페이지 이동 시 호출됨
  updateWebviewMeta: (id, liveTitle, liveUrl) =>
    set((state) => ({
      cards: state.cards.map((c) =>
        c.id === id && c.type === 'webview' ? { ...c, liveTitle, liveUrl } : c
      ),
    })),

  // 카드 자동 정렬 — 'grid'는 3열 격자형, 'stack'은 세로 한 줄 배치
  rearrangeCards: (layout) =>
    set((state) => {
      const { cards } = state
      if (cards.length === 0) return state

      // 격자형: 3열로 카드를 가로세로 정렬
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

      // 세로형: 카드들을 위에서 아래로 한 줄로 정렬
      let currentY = 80
      return {
        cards: cards.map((card) => {
          const y = currentY
          currentY += card.height + CARD_GAP
          return { ...card, x: 80, y }
        }),
      }
    }),

  // --- 연결선(Edge) 관리 ---

  // 두 카드 사이에 연결선 추가 — AI가 관련 카드들을 연결할 때 사용
  addEdge: (from, to, strength, label) => {
    const { edges } = get()
    // 이미 같은 두 카드 사이에 연결선이 있으면 중복 생성하지 않음
    const exists = edges.some(
      (e) => (e.fromNodeId === from && e.toNodeId === to) ||
             (e.fromNodeId === to && e.toNodeId === from)
    )
    if (exists) return

    // 새 연결선 생성
    const edge: EdgeData = {
      id: crypto.randomUUID(),
      fromNodeId: from,
      toNodeId: to,
      strength,   // 연결 강도: strong(강), weak(약), speculative(추측)
      label,      // 연결선에 표시할 라벨 텍스트 (선택)
    }
    set((state) => ({ edges: [...state.edges, edge] }))
  },

  // 특정 연결선 삭제
  removeEdge: (id) =>
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== id),
    })),

  // --- 마우스 호버 / 카드 고정(Pin) ---

  // 마우스가 올려진 카드 설정 — 해당 카드의 연결선이 표시됨
  setHoveredNode: (id) => set({ hoveredNodeId: id }),

  // 카드 고정/해제 토글 — 고정된 카드는 연결선이 항상 표시됨
  togglePinNode: (id) =>
    set((state) => {
      const isPinned = state.pinnedNodeIds.includes(id)
      return {
        pinnedNodeIds: isPinned
          ? state.pinnedNodeIds.filter((nid) => nid !== id)  // 이미 고정되어 있으면 해제
          : [...state.pinnedNodeIds, id],                     // 고정되어 있지 않으면 고정
      }
    }),

  // 모든 카드의 고정 상태 해제
  clearPins: () => set({ pinnedNodeIds: [] }),

  // 모든 연결선 표시/숨김 토글
  toggleShowAllEdges: () =>
    set((state) => ({ showAllEdges: !state.showAllEdges })),
}))
