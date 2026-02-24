import type { ConnectionStatus, TickerData } from '../types'
import type { DataSource } from './dataSource'

const WS_URL = 'wss://stream.binance.com:9443/ws'
const MAX_RECONNECT_DELAY = 30000

export class BinanceDataSource implements DataSource {
  readonly name = 'binance'
  status: ConnectionStatus = 'disconnected'
  onTicker: ((data: TickerData) => void) | null = null
  onStatusChange: ((status: ConnectionStatus) => void) | null = null

  private ws: WebSocket | null = null
  private subscribedSymbols: Set<string> = new Set()
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectDelay = 1000
  private idCounter = 1

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return
    }
    this.setStatus('connecting')
    this.ws = new WebSocket(WS_URL)

    this.ws.onopen = () => {
      this.setStatus('connected')
      this.reconnectDelay = 1000

      // 재접속 시 기존 구독 복원
      if (this.subscribedSymbols.size > 0) {
        this.sendSubscribe([...this.subscribedSymbols])
      }
    }

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        // 구독 응답은 무시
        if (data.result !== undefined || data.id) return
        if (data.e === '24hrTicker') {
          this.handleTicker(data)
        }
      } catch {
        // 파싱 실패 무시
      }
    }

    this.ws.onclose = () => {
      if (this.status !== 'disconnected') {
        this.setStatus('reconnecting')
        this.scheduleReconnect()
      }
    }

    this.ws.onerror = () => {
      // onclose에서 재접속 처리
    }
  }

  disconnect() {
    this.setStatus('disconnected')
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.onclose = null
      this.ws.close()
      this.ws = null
    }
  }

  subscribe(symbol: string) {
    const normalized = symbol.toLowerCase()
    if (this.subscribedSymbols.has(normalized)) return
    this.subscribedSymbols.add(normalized)

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscribe([normalized])
    }
  }

  unsubscribe(symbol: string) {
    const normalized = symbol.toLowerCase()
    if (!this.subscribedSymbols.has(normalized)) return
    this.subscribedSymbols.delete(normalized)

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendUnsubscribe([normalized])
    }
  }

  private sendSubscribe(symbols: string[]) {
    const params = symbols.map((s) => `${s}@ticker`)
    this.ws?.send(JSON.stringify({
      method: 'SUBSCRIBE',
      params,
      id: this.idCounter++,
    }))
  }

  private sendUnsubscribe(symbols: string[]) {
    const params = symbols.map((s) => `${s}@ticker`)
    this.ws?.send(JSON.stringify({
      method: 'UNSUBSCRIBE',
      params,
      id: this.idCounter++,
    }))
  }

  private handleTicker(data: Record<string, unknown>) {
    const now = Date.now()
    const eventTime = data.E as number
    const ticker: TickerData = {
      symbol: (data.s as string).toUpperCase(),
      price: parseFloat(data.c as string),
      prevPrice: 0, // store에서 이전 가격으로 교체
      change24h: parseFloat(data.P as string),
      volume24h: parseFloat(data.v as string),
      high24h: parseFloat(data.h as string),
      low24h: parseFloat(data.l as string),
      latency: now - eventTime,
      lastUpdate: now,
      source: this.name,
    }
    this.onTicker?.(ticker)
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY)
      this.connect()
    }, this.reconnectDelay)
  }

  private setStatus(status: ConnectionStatus) {
    this.status = status
    this.onStatusChange?.(status)
  }
}
