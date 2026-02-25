import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  apiKey: string
  tavilyApiKey: string
  contextPrompt: string
  model: string
  enableAiScoring: boolean
  setApiKey: (key: string) => void
  setTavilyApiKey: (key: string) => void
  setContextPrompt: (prompt: string) => void
  setModel: (model: string) => void
  setEnableAiScoring: (v: boolean) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiKey: '',
      tavilyApiKey: '',
      contextPrompt: '',
      model: 'claude-sonnet-4-20250514',
      enableAiScoring: true,
      setApiKey: (apiKey) => set({ apiKey }),
      setTavilyApiKey: (tavilyApiKey) => set({ tavilyApiKey }),
      setContextPrompt: (contextPrompt) => set({ contextPrompt }),
      setModel: (model) => set({ model }),
      setEnableAiScoring: (enableAiScoring) => set({ enableAiScoring }),
    }),
    { name: 'travis-settings' }
  )
)
