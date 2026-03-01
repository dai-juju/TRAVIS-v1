// Zustand — 상태 관리 라이브러리
import { create } from 'zustand'

// 채팅 메시지 1개의 구조 정의
export interface Message {
  id: string                     // 메시지 고유 ID
  role: 'user' | 'assistant'    // 누가 보냈는지 (user = 사용자, assistant = AI)
  content: string                // 메시지 내용
  timestamp: number              // 보낸 시간 (밀리초 단위 타임스탬프)
}

// 채팅 저장소의 전체 상태와 기능 정의
interface ChatState {
  messages: Message[]                                                  // 전체 채팅 메시지 목록
  isLoading: boolean                                                   // AI가 응답 중인지 여부
  streamingMessageId: string | null                                    // 현재 스트리밍(실시간 타이핑) 중인 메시지 ID
  focusedCard: { id: string; title: string; content: string } | null   // 현재 참조 중인 카드 (카드 클릭 시 설정됨)

  addMessage: (role: Message['role'], content: string) => string    // 새 메시지 추가
  updateMessage: (id: string, content: string) => void              // 메시지 내용 교체
  appendToMessage: (id: string, text: string) => void               // 메시지 끝에 텍스트 이어 붙이기 (스트리밍용)
  setLoading: (loading: boolean) => void                            // 로딩 상태 설정
  setStreamingMessageId: (id: string | null) => void                // 스트리밍 중인 메시지 ID 설정
  setFocusedCard: (card: { id: string; title: string; content: string }) => void  // 참조 카드 설정
  clearFocusedCard: () => void                                      // 참조 카드 해제
  clearMessages: () => void                                         // 전체 채팅 내역 삭제
}

// ====================================================================
// 채팅 저장소 — 사용자와 AI 간의 대화 내역을 관리하는 중앙 금고
// 사용자가 채팅창에 입력하면 여기에 메시지가 쌓이고, AI 응답도 여기에 저장됨
// ====================================================================
export const useChatStore = create<ChatState>((set) => ({
  messages: [],               // 처음엔 대화 내역이 비어있음
  isLoading: false,           // AI가 아직 응답 중이 아님
  streamingMessageId: null,   // 스트리밍 중인 메시지 없음
  focusedCard: null,          // 참조 중인 카드 없음

  // 새 메시지를 대화 목록에 추가하고 고유 ID를 반환
  addMessage: (role, content) => {
    const id = crypto.randomUUID()  // 랜덤 고유 ID 생성
    set((state) => ({
      messages: [
        ...state.messages,
        { id, role, content, timestamp: Date.now() },
      ],
    }))
    return id
  },

  // 특정 메시지의 내용을 완전히 교체 (스트리밍 완료 후 최종 내용 세팅)
  updateMessage: (id, content) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, content } : m
      ),
    })),

  // 특정 메시지 끝에 텍스트를 이어 붙임 — AI 응답이 글자 단위로 들어올 때 사용
  appendToMessage: (id, text) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, content: m.content + text } : m
      ),
    })),

  // AI 응답 로딩 중 여부 설정
  setLoading: (isLoading) => set({ isLoading }),

  // 현재 스트리밍(실시간 타이핑) 중인 메시지 ID 설정/해제
  setStreamingMessageId: (streamingMessageId) => set({ streamingMessageId }),

  // 사용자가 캔버스에서 카드를 클릭하면 해당 카드를 "참조 카드"로 설정
  // → AI에게 "이 카드에 대해 질문하고 있어요"라고 컨텍스트를 전달하는 용도
  setFocusedCard: (card) => set({ focusedCard: card }),

  // 참조 카드 해제
  clearFocusedCard: () => set({ focusedCard: null }),

  // 전체 대화 내역 삭제 — 새로 시작할 때 사용
  clearMessages: () => set({ messages: [], streamingMessageId: null, focusedCard: null }),
}))
