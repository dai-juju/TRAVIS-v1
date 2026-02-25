import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  apiKey: string
  tavilyApiKey: string
  contextPrompt: string
  model: string
  setApiKey: (key: string) => void
  setTavilyApiKey: (key: string) => void
  setContextPrompt: (prompt: string) => void
  setModel: (model: string) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiKey: '',
      tavilyApiKey: '',
      contextPrompt: '',
      model: 'claude-sonnet-4-20250514',
      setApiKey: (apiKey) => set({ apiKey }),
      setTavilyApiKey: (tavilyApiKey) => set({ tavilyApiKey }),
      setContextPrompt: (contextPrompt) => set({ contextPrompt }),
      setModel: (model) => set({ model }),
    }),
    { name: 'travis-settings' }
  )
)
