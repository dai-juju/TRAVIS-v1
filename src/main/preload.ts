import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  // 기존 non-streaming
  sendChatMessage: (payload: unknown) =>
    ipcRenderer.invoke('claude:chat', payload),

  // 스트리밍
  startChatStream: (payload: unknown) =>
    ipcRenderer.send('claude:chat-stream', payload),
  onStreamEvent: (channel: string, callback: (data: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data)
    ipcRenderer.on(channel, listener)
    return () => { ipcRenderer.removeListener(channel, listener) }
  },

  // 기존 유지
  getTradFiQuotes: () =>
    ipcRenderer.invoke('tradfi:quotes'),
  searchWeb: (query: string, apiKey: string) =>
    ipcRenderer.invoke('tavily:search', { query, apiKey }),
  fetchCryptoNews: () => ipcRenderer.invoke('feed:cryptonews'),
  fetchFearGreed: () => ipcRenderer.invoke('feed:feargreed'),

  // Investigation Mode APIs
  fetchKlines: (symbol: string, interval: string, limit: number) =>
    ipcRenderer.invoke('binance:klines', { symbol, interval, limit }),
  fetchRecentTrades: (symbol: string, limit: number) =>
    ipcRenderer.invoke('binance:trades', { symbol, limit }),
  fetchMultipleTickers: (symbols: string[]) =>
    ipcRenderer.invoke('binance:multi-ticker', { symbols }),
  fetchCoinData: (coinId: string) =>
    ipcRenderer.invoke('coingecko:coin-data', { coinId }),
})
