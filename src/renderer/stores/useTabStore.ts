import { create } from 'zustand'

type Tab = 'command' | 'feed'

interface TabStore {
  activeTab: Tab
  setTab: (tab: Tab) => void
}

export const useTabStore = create<TabStore>((set) => ({
  activeTab: 'command',
  setTab: (tab) => set({ activeTab: tab }),
}))
