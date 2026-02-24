import type { ConnectionStatus, TickerData } from '../types'

export interface DataSource {
  readonly name: string
  status: ConnectionStatus
  connect(): void
  disconnect(): void
  subscribe(symbol: string): void
  unsubscribe(symbol: string): void
  onTicker: ((data: TickerData) => void) | null
  onStatusChange: ((status: ConnectionStatus) => void) | null
}

class DataSourceManager {
  private sources: DataSource[] = []
  private refCounts: Map<string, number> = new Map()

  registerSource(source: DataSource) {
    this.sources.push(source)
  }

  connectAll() {
    for (const source of this.sources) {
      source.connect()
    }
  }

  disconnectAll() {
    for (const source of this.sources) {
      source.disconnect()
    }
  }

  // 심볼에 맞는 소스 선택 (현재는 첫 번째 소스 사용, 향후 라우팅 로직 추가)
  private getSourceForSymbol(_symbol: string): DataSource | null {
    return this.sources[0] || null
  }

  subscribe(symbol: string) {
    const count = this.refCounts.get(symbol) || 0
    this.refCounts.set(symbol, count + 1)

    // 첫 구독일 때만 실제 subscribe
    if (count === 0) {
      const source = this.getSourceForSymbol(symbol)
      source?.subscribe(symbol)
    }
  }

  unsubscribe(symbol: string) {
    const count = this.refCounts.get(symbol) || 0
    if (count <= 1) {
      this.refCounts.delete(symbol)
      const source = this.getSourceForSymbol(symbol)
      source?.unsubscribe(symbol)
    } else {
      this.refCounts.set(symbol, count - 1)
    }
  }

  getOverallStatus(): ConnectionStatus {
    if (this.sources.length === 0) return 'disconnected'
    // 하나라도 connected면 connected
    if (this.sources.some((s) => s.status === 'connected')) return 'connected'
    if (this.sources.some((s) => s.status === 'reconnecting')) return 'reconnecting'
    if (this.sources.some((s) => s.status === 'connecting')) return 'connecting'
    return 'disconnected'
  }
}

export const dataSourceManager = new DataSourceManager()
