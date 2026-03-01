// 데이터 소스 인터페이스 + 매니저
// 여러 거래소(바이낸스 등)의 실시간 데이터를 통합 관리하는 중간 계층

// 연결 상태와 시세 데이터 타입 가져오기
import type { ConnectionStatus, TickerData } from '../types'

// 데이터 소스 인터페이스 — 모든 실시간 데이터 소스가 따라야 하는 규격
// 현재는 바이낸스만 구현되어 있지만, 향후 다른 거래소 추가 시 이 규격을 따르면 됨
export interface DataSource {
  readonly name: string                                          // 데이터 소스 이름 (예: 'binance')
  status: ConnectionStatus                                       // 현재 연결 상태
  connect(): void                                                // 연결 시작
  disconnect(): void                                             // 연결 종료
  subscribe(symbol: string): void                                // 코인 시세 구독
  unsubscribe(symbol: string): void                              // 코인 시세 구독 해제
  onTicker: ((data: TickerData) => void) | null                 // 시세 데이터 수신 콜백
  onStatusChange: ((status: ConnectionStatus) => void) | null   // 연결 상태 변경 콜백
}

// ====================================================================
// 데이터 소스 매니저 — 여러 데이터 소스를 통합 관리하는 중앙 관리자
// 구독 참조 카운트(refCount)를 관리하여 같은 코인을 여러 카드가 구독해도 실제 구독은 1번만
// 예: BTC 카드가 3개 있어도 바이낸스에는 BTC 구독 1번만 보냄
// ====================================================================
class DataSourceManager {
  private sources: DataSource[] = []                    // 등록된 데이터 소스 목록
  private refCounts: Map<string, number> = new Map()    // 심볼별 구독 참조 카운트

  // 데이터 소스 등록 (앱 시작 시 바이낸스 소스를 등록)
  registerSource(source: DataSource) {
    this.sources.push(source)
  }

  // 등록된 모든 데이터 소스에 연결
  connectAll() {
    for (const source of this.sources) {
      source.connect()
    }
  }

  // 등록된 모든 데이터 소스 연결 해제
  disconnectAll() {
    for (const source of this.sources) {
      source.disconnect()
    }
  }

  // 심볼에 맞는 데이터 소스를 선택 (현재는 첫 번째 소스(바이낸스) 사용)
  // 향후 다른 거래소 추가 시 심볼에 따라 적절한 소스를 선택하는 라우팅 로직 추가 예정
  private getSourceForSymbol(_symbol: string): DataSource | null {
    return this.sources[0] || null
  }

  // 코인 시세 구독 — 참조 카운트 방식으로 중복 구독 방지
  // 여러 카드가 같은 코인을 구독해도 실제 WebSocket 구독은 1번만 (비용 절약)
  subscribe(symbol: string) {
    const count = this.refCounts.get(symbol) || 0
    this.refCounts.set(symbol, count + 1)

    // 해당 심볼의 첫 번째 구독일 때만 실제로 데이터 소스에 구독 요청
    if (count === 0) {
      const source = this.getSourceForSymbol(symbol)
      source?.subscribe(symbol)
    }
  }

  // 코인 시세 구독 해제 — 참조 카운트가 0이 되면 실제 구독 해제
  unsubscribe(symbol: string) {
    const count = this.refCounts.get(symbol) || 0
    if (count <= 1) {
      // 마지막 구독자가 해제 → 실제 WebSocket 구독도 해제
      this.refCounts.delete(symbol)
      const source = this.getSourceForSymbol(symbol)
      source?.unsubscribe(symbol)
    } else {
      // 아직 다른 구독자가 있으므로 카운트만 줄임
      this.refCounts.set(symbol, count - 1)
    }
  }

  // 전체 데이터 소스의 연결 상태를 하나로 요약
  // 하나라도 연결되어 있으면 'connected'로 표시
  getOverallStatus(): ConnectionStatus {
    if (this.sources.length === 0) return 'disconnected'
    if (this.sources.some((s) => s.status === 'connected')) return 'connected'
    if (this.sources.some((s) => s.status === 'reconnecting')) return 'reconnecting'
    if (this.sources.some((s) => s.status === 'connecting')) return 'connecting'
    return 'disconnected'
  }
}

// 데이터 소스 매니저의 싱글톤 인스턴스 — 앱 전체에서 하나만 사용
export const dataSourceManager = new DataSourceManager()
