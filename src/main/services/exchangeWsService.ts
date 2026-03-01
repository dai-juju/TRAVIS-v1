// ============================================================
// Exchange WebSocket Service — CCXT Pro 기반 통합 실시간 데이터
// Phase 3A-6: 6개 거래소(Binance, Upbit, Bybit, Bithumb, OKX, Coinbase)의
// 실시간 시세 및 대형 체결을 CCXT Pro WebSocket으로 수신
// 메인 프로세스(Node.js)에서 실행, IPC로 렌더러에 전달
// 기존 binanceWs.ts는 그대로 유지 — 이 서비스는 별도 인프라
// ============================================================

import type { BrowserWindow } from 'electron'

// CCXT Pro는 ccxt.pro 네임스페이스에서 접근
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ccxt = require('ccxt')

// WS 지원 거래소 목록
const WS_SUPPORTED_EXCHANGES = ['binance', 'upbit', 'bybit', 'bithumb', 'okx', 'coinbase'] as const
type WsExchangeId = typeof WS_SUPPORTED_EXCHANGES[number]

// 렌더러에 전송되는 시세 업데이트 데이터
interface TickerUpdate {
  exchange: string
  symbol: string        // "BTC/USDT" 또는 "BTC/KRW"
  last: number
  bid: number
  ask: number
  high: number
  low: number
  baseVolume: number
  quoteVolume: number
  percentage: number    // 24h 변동률
  timestamp: number
}

// 렌더러에 전송되는 대형 체결 데이터
interface TradeUpdate {
  exchange: string
  symbol: string
  price: number
  amount: number
  cost: number          // price × amount (USDT/KRW 금액)
  side: 'buy' | 'sell'
  timestamp: number
}

// ====================================================================
// 통합 거래소 WebSocket 서비스
// CCXT Pro의 watchTicker/watchTrades를 래핑하여 통일된 인터페이스 제공
// lazy 초기화, 5분 idle 자동 해제, IPC 기반 렌더러 전달
// ====================================================================
class ExchangeWsService {
  // CCXT Pro 거래소 인스턴스 캐시 (lazy 초기화)
  private exchanges: Map<string, InstanceType<typeof ccxt.Exchange>> = new Map()
  // 활성 와처 추적: "binance:BTC/USDT:ticker" → true/false
  private activeWatchers: Map<string, boolean> = new Map()
  // 5분 idle 자동 해제 타이머
  private idleTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()
  private readonly idleTimeoutMs = 5 * 60 * 1000 // 5분

  // BrowserWindow 참조 (IPC 전송용)
  private mainWindow: BrowserWindow | null = null

  // 메인 윈도우 참조 설정 (index.ts에서 창 생성 후 호출)
  setMainWindow(win: BrowserWindow) {
    this.mainWindow = win
  }

  // CCXT Pro 인스턴스 가져오기 (lazy 초기화)
  private getExchange(exchangeId: WsExchangeId): InstanceType<typeof ccxt.Exchange> {
    if (!this.exchanges.has(exchangeId)) {
      const ProClass = ccxt.pro[exchangeId]
      if (!ProClass) {
        console.error(`[ExchangeWsService] ${exchangeId} not available in ccxt.pro`)
        throw new Error(`Exchange ${exchangeId} WS not supported`)
      }

      const exchange = new ProClass({
        enableRateLimit: true,
        options: {
          defaultType: 'spot',
        },
      })

      this.exchanges.set(exchangeId, exchange)
    }
    return this.exchanges.get(exchangeId)!
  }

  // === 실시간 시세 구독 ===
  // CCXT Pro의 watchTicker는 무한 루프로 동작 — 새 데이터가 올 때마다 resolve
  async watchTicker(exchangeId: WsExchangeId, symbol: string) {
    const key = `${exchangeId}:${symbol}:ticker`
    if (this.activeWatchers.get(key)) return // 이미 구독 중

    this.activeWatchers.set(key, true)
    this.resetIdleTimer(key)

    console.log(`[ExchangeWsService] Starting ticker watch: ${key}`)

    try {
      const exchange = this.getExchange(exchangeId)

      // CCXT Pro watchTicker 무한 루프 — activeWatchers가 false가 되면 종료
      while (this.activeWatchers.get(key)) {
        try {
          const ticker = await exchange.watchTicker(symbol)

          const update: TickerUpdate = {
            exchange: exchangeId,
            symbol: ticker.symbol,
            last: ticker.last || 0,
            bid: ticker.bid || 0,
            ask: ticker.ask || 0,
            high: ticker.high || 0,
            low: ticker.low || 0,
            baseVolume: ticker.baseVolume || 0,
            quoteVolume: ticker.quoteVolume || 0,
            percentage: ticker.percentage || 0,
            timestamp: ticker.timestamp || Date.now(),
          }

          // IPC로 렌더러에 전송
          if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('exchange-ticker-update', update)
          }

          this.resetIdleTimer(key)
        } catch (error) {
          if (!this.activeWatchers.get(key)) break // 의도적 종료
          console.error(`[ExchangeWsService] watchTicker error for ${key}:`, error)
          // 짧은 대기 후 재시도 (루프 내에서)
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }
    } catch (error) {
      console.error(`[ExchangeWsService] Failed to start watchTicker for ${key}:`, error)
    } finally {
      this.activeWatchers.delete(key)
      this.clearIdleTimer(key)
      console.log(`[ExchangeWsService] Ticker watch ended: ${key}`)
    }
  }

  // === 실시간 체결 구독 (대형 거래 탐지) ===
  // minAmountUSDT 이상의 체결만 렌더러에 전달
  async watchTrades(exchangeId: WsExchangeId, symbol: string, minAmountUSDT: number = 50000) {
    const key = `${exchangeId}:${symbol}:trades`
    if (this.activeWatchers.get(key)) return

    this.activeWatchers.set(key, true)
    this.resetIdleTimer(key)

    console.log(`[ExchangeWsService] Starting trades watch: ${key} (min: $${minAmountUSDT})`)

    try {
      const exchange = this.getExchange(exchangeId)

      while (this.activeWatchers.get(key)) {
        try {
          const trades = await exchange.watchTrades(symbol)

          // 대형 거래만 필터링하여 전송
          for (const trade of trades) {
            const cost = trade.cost || (trade.price * trade.amount) || 0
            if (cost >= minAmountUSDT) {
              const update: TradeUpdate = {
                exchange: exchangeId,
                symbol: trade.symbol,
                price: trade.price,
                amount: trade.amount,
                cost,
                side: trade.side as 'buy' | 'sell',
                timestamp: trade.timestamp || Date.now(),
              }

              if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                this.mainWindow.webContents.send('exchange-large-trade', update)
              }
            }
          }

          this.resetIdleTimer(key)
        } catch (error) {
          if (!this.activeWatchers.get(key)) break
          console.error(`[ExchangeWsService] watchTrades error for ${key}:`, error)
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }
    } catch (error) {
      console.error(`[ExchangeWsService] Failed to start watchTrades for ${key}:`, error)
    } finally {
      this.activeWatchers.delete(key)
      this.clearIdleTimer(key)
      console.log(`[ExchangeWsService] Trades watch ended: ${key}`)
    }
  }

  // === 구독 해제 ===
  unwatch(exchangeId: string, symbol: string, type: 'ticker' | 'trades') {
    const key = `${exchangeId}:${symbol}:${type}`
    if (this.activeWatchers.has(key)) {
      this.activeWatchers.set(key, false)
      this.clearIdleTimer(key)
      console.log(`[ExchangeWsService] Stopped watching: ${key}`)
    }
  }

  // === 전체 해제 (앱 종료 시) ===
  unwatchAll() {
    // 모든 와처 중단
    for (const key of this.activeWatchers.keys()) {
      this.activeWatchers.set(key, false)
    }

    // 모든 idle 타이머 정리
    for (const timer of this.idleTimers.values()) {
      clearTimeout(timer)
    }
    this.idleTimers.clear()

    // 모든 CCXT Pro 인스턴스 close (WS 연결 해제)
    for (const [id, exchange] of this.exchanges) {
      try {
        if (typeof exchange.close === 'function') {
          exchange.close()
        }
      } catch (e) {
        console.error(`[ExchangeWsService] Error closing ${id}:`, e)
      }
    }
    this.exchanges.clear()
    console.log('[ExchangeWsService] All watchers stopped and exchanges closed')
  }

  // === Idle 타이머 관리 ===
  // 5분 동안 데이터 수신이 없으면 자동으로 구독 해제 (리소스 절약)
  private resetIdleTimer(key: string) {
    this.clearIdleTimer(key)
    this.idleTimers.set(key, setTimeout(() => {
      console.log(`[ExchangeWsService] Idle timeout for ${key}`)
      this.activeWatchers.set(key, false)
      this.idleTimers.delete(key)
    }, this.idleTimeoutMs))
  }

  private clearIdleTimer(key: string) {
    const existing = this.idleTimers.get(key)
    if (existing) {
      clearTimeout(existing)
      this.idleTimers.delete(key)
    }
  }

  // 현재 활성 와처 목록
  getActiveWatchers(): string[] {
    return [...this.activeWatchers.entries()]
      .filter(([, active]) => active)
      .map(([key]) => key)
  }

  // 지원 거래소 목록
  getSupportedExchanges(): string[] {
    return [...WS_SUPPORTED_EXCHANGES]
  }
}

// 싱글톤 인스턴스 — 앱 전체에서 하나만 사용
export const exchangeWsService = new ExchangeWsService()
