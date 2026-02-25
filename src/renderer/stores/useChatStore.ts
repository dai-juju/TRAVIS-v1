import { create } from 'zustand'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface ChatState {
  messages: Message[]
  isLoading: boolean
  streamingMessageId: string | null
  focusedCard: { id: string; title: string; content: string } | null

  addMessage: (role: Message['role'], content: string) => string
  updateMessage: (id: string, content: string) => void
  appendToMessage: (id: string, text: string) => void
  setLoading: (loading: boolean) => void
  setStreamingMessageId: (id: string | null) => void
  setFocusedCard: (card: { id: string; title: string; content: string }) => void
  clearFocusedCard: () => void
  clearMessages: () => void
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,
  streamingMessageId: null,
  focusedCard: null,

  addMessage: (role, content) => {
    const id = crypto.randomUUID()
    set((state) => ({
      messages: [
        ...state.messages,
        { id, role, content, timestamp: Date.now() },
      ],
    }))
    return id
  },

  updateMessage: (id, content) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, content } : m
      ),
    })),

  appendToMessage: (id, text) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, content: m.content + text } : m
      ),
    })),

  setLoading: (isLoading) => set({ isLoading }),

  setStreamingMessageId: (streamingMessageId) => set({ streamingMessageId }),

  setFocusedCard: (card) => set({ focusedCard: card }),

  clearFocusedCard: () => set({ focusedCard: null }),

  clearMessages: () => set({ messages: [], streamingMessageId: null, focusedCard: null }),
}))
