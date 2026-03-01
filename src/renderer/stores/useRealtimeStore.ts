// Zustand — 상태 관리 라이브러리
import { create } from 'zustand'
// 연결 상태와 시세 데이터 타입 가져오기
import type { ConnectionStatus, TickerData } from '../types'
// 데이터 소스 매니저 — 바이낸스 등 실시간 데이터 연결을 관리하는 서비스
import { dataSourceManager } from '../services/dataSource'

// 실시간 데이터 저장소의 전체 상태와 기능 정의
interface RealtimeState {
  tickers: Record<string, TickerData>                    // 코인별 실시간 시세 데이터 (키: 심볼명, 값: 시세)
  connectionStatus: ConnectionStatus                     // WebSocket 연결 상태
  updateTicker: (data: TickerData) => void              // 시세 데이터 업데이트
  setConnectionStatus: (status: ConnectionStatus) => void  // 연결 상태 변경
  subscribe: (symbol: string) => void                    // 특정 코인 시세 구독 시작
  unsubscribe: (symbol: string) => void                  // 특정 코인 시세 구독 해제
}

// ====================================================================
// 실시간 시세 저장소 — 바이낸스에서 들어오는 코인 가격 데이터를 관리하는 금고
// WebSocket으로 실시간 가격을 받아서 여기에 저장하고, UI가 이 데이터를 읽어서 표시함
// ====================================================================
export const useRealtimeStore = create<RealtimeState>((set) => ({
  tickers: {},                     // 처음엔 시세 데이터가 비어있음
  connectionStatus: 'disconnected', // 처음엔 연결되지 않은 상태

  // 시세 데이터 업데이트 — WebSocket에서 새 가격이 들어올 때마다 호출됨
  // 이전 가격(prevPrice)을 보관하여 가격 상승/하락 표시에 사용
  updateTicker: (data) =>
    set((state) => {
      const existing = state.tickers[data.symbol]  // 해당 코인의 기존 데이터
      return {
        tickers: {
          ...state.tickers,
          [data.symbol]: {
            ...data,
            // 기존 데이터가 있으면 이전 가격을 보존, 없으면 현재 가격을 이전 가격으로 설정
            prevPrice: existing ? existing.price : data.price,
          },
        },
      }
    }),

  // WebSocket 연결 상태 변경 (disconnected → connecting → connected → reconnecting)
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),

  // 특정 코인의 실시간 시세 구독 시작 — 카드에 심볼이 있을 때 자동 호출됨
  subscribe: (symbol) => {
    dataSourceManager.subscribe(symbol)
  },

  // 특정 코인의 실시간 시세 구독 해제 — 해당 카드가 삭제될 때 호출됨
  unsubscribe: (symbol) => {
    dataSourceManager.unsubscribe(symbol)
  },
}))
