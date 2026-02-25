import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  sendChatMessage: (payload: unknown) =>
    ipcRenderer.invoke('claude:chat', payload),
  getTradFiQuotes: () =>
    ipcRenderer.invoke('tradfi:quotes'),
  searchWeb: (query: string, apiKey: string) =>
    ipcRenderer.invoke('tavily:search', { query, apiKey }),
  fetchCryptoNews: () => ipcRenderer.invoke('feed:cryptonews'),
  fetchFearGreed: () => ipcRenderer.invoke('feed:feargreed'),
})
