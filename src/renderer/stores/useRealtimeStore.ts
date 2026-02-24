import { create } from 'zustand'
import type { ConnectionStatus, TickerData } from '../types'
import { dataSourceManager } from '../services/dataSource'

interface RealtimeState {
  tickers: Record<string, TickerData>
  connectionStatus: ConnectionStatus
  updateTicker: (data: TickerData) => void
  setConnectionStatus: (status: ConnectionStatus) => void
  subscribe: (symbol: string) => void
  unsubscribe: (symbol: string) => void
}

export const useRealtimeStore = create<RealtimeState>((set) => ({
  tickers: {},
  connectionStatus: 'disconnected',

  updateTicker: (data) =>
    set((state) => {
      const existing = state.tickers[data.symbol]
      return {
        tickers: {
          ...state.tickers,
          [data.symbol]: {
            ...data,
            prevPrice: existing ? existing.price : data.price,
          },
        },
      }
    }),

  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),

  subscribe: (symbol) => {
    dataSourceManager.subscribe(symbol)
  },

  unsubscribe: (symbol) => {
    dataSourceManager.unsubscribe(symbol)
  },
}))
