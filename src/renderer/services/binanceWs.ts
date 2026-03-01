// 바이낸스 WebSocket 실시간 시세 데이터 서비스
// 바이낸스 거래소의 WebSocket API를 통해 코인 가격을 실시간으로 받아오는 역할

// 연결 상태와 시세 데이터 타입 가져오기
import type { ConnectionStatus, TickerData } from '../types'
// 데이터 소스 인터페이스 — 모든 데이터 소스가 동일한 규격을 따르도록 정의
import type { DataSource } from './dataSource'

// 바이낸스 WebSocket 서버 주소
const WS_URL = 'wss://stream.binance.com:9443/ws'
// 재접속 시 최대 대기 시간 (30초) — 연결이 끊기면 점점 길게 기다렸다 재시도
const MAX_RECONNECT_DELAY = 16000
const MAX_RECONNECT_ATTEMPTS = 5

// ====================================================================
// 바이낸스 데이터 소스 — 바이낸스 거래소에서 실시간 코인 가격을 받아오는 서비스
// WebSocket 연결로 구독한 코인의 24시간 시세 데이터를 지속적으로 수신
// ====================================================================
export class BinanceDataSource implements DataSource {
  readonly name = 'binance'                          // 데이터 소스 이름
  status: ConnectionStatus = 'disconnected'          // 현재 연결 상태
  onTicker: ((data: TickerData) => void) | null = null          // 시세 수신 콜백 (저장소에 전달)
  onStatusChange: ((status: ConnectionStatus) => void) | null = null  // 연결 상태 변경 콜백

  private ws: WebSocket | null = null                // WebSocket 연결 객체
  private subscribedSymbols: Set<string> = new Set() // 현재 구독 중인 코인 심볼 목록
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null  // 재접속 타이머
  private reconnectDelay = 1000                      // 현재 재접속 대기 시간 (점점 늘어남)
  private reconnectAttempts = 0                      // 재접속 시도 횟수
  private idCounter = 1                              // WebSocket 메시지 ID (바이낸스 프로토콜 요구사항)

  // 바이낸스 WebSocket에 연결하는 함수
  connect() {
    // 이미 연결 중이거나 연결되어 있으면 무시
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return
    }
    this.setStatus('connecting')
    this.ws = new WebSocket(WS_URL)

    // WebSocket 연결 성공 시
    this.ws.onopen = () => {
      this.setStatus('connected')
      this.reconnectDelay = 1000  // 재접속 대기 시간 초기화
      this.reconnectAttempts = 0  // 재접속 시도 횟수 초기화

      // 재접속인 경우: 이전에 구독하던 심볼들을 다시 구독 복원
      if (this.subscribedSymbols.size > 0) {
        this.sendSubscribe([...this.subscribedSymbols])
      }
    }

    // WebSocket으로 데이터가 수신될 때마다 호출
    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        // 구독 확인 응답 메시지는 무시 (시세 데이터만 처리)
        if (data.result !== undefined || data.id) return
        // 24시간 시세 데이터인 경우 처리
        if (data.e === '24hrTicker') {
          this.handleTicker(data)
        }
      } catch {
        // JSON 파싱 실패는 조용히 무시
      }
    }

    // WebSocket 연결이 끊겼을 때 — 자동 재접속 시도
    this.ws.onclose = () => {
      if (this.status !== 'disconnected') {  // 의도적 종료가 아닌 경우만 재접속
        this.setStatus('reconnecting')
        this.scheduleReconnect()
      }
    }

    // WebSocket 에러 발생 시 — onclose에서 재접속 처리하므로 여기서는 무시
    this.ws.onerror = () => {
    }
  }

  // WebSocket 연결을 의도적으로 종료하는 함수
  disconnect() {
    this.setStatus('disconnected')
    // 재접속 타이머가 있으면 취소
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    // WebSocket 연결 종료
    if (this.ws) {
      this.ws.onclose = null  // 재접속 방지를 위해 onclose 콜백 제거
      this.ws.close()
      this.ws = null
    }
  }

  // 특정 코인의 시세 구독 시작 (예: "btcusdt" → 바이낸스에 구독 요청)
  subscribe(symbol: string) {
    const normalized = symbol.toLowerCase()  // 바이낸스는 소문자 심볼 사용
    if (this.subscribedSymbols.has(normalized)) return  // 이미 구독 중이면 무시
    this.subscribedSymbols.add(normalized)

    // 연결이 열려있으면 즉시 구독 요청, 아니면 연결 후 자동 복원됨
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscribe([normalized])
    }
  }

  // 특정 코인의 시세 구독 해제
  unsubscribe(symbol: string) {
    const normalized = symbol.toLowerCase()
    if (!this.subscribedSymbols.has(normalized)) return
    this.subscribedSymbols.delete(normalized)

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendUnsubscribe([normalized])
    }
  }

  // 바이낸스에 시세 구독 요청 전송 — "이 코인들의 시세를 보내주세요"
  private sendSubscribe(symbols: string[]) {
    const params = symbols.map((s) => `${s}@ticker`)  // 바이낸스 스트림 형식: "btcusdt@ticker"
    this.ws?.send(JSON.stringify({
      method: 'SUBSCRIBE',
      params,
      id: this.idCounter++,
    }))
  }

  // 바이낸스에 시세 구독 해제 요청 전송
  private sendUnsubscribe(symbols: string[]) {
    const params = symbols.map((s) => `${s}@ticker`)
    this.ws?.send(JSON.stringify({
      method: 'UNSUBSCRIBE',
      params,
      id: this.idCounter++,
    }))
  }

  // 바이낸스에서 받은 원시 시세 데이터를 우리 시스템 형식(TickerData)으로 변환
  // 바이낸스 데이터 필드: s=심볼, c=현재가, P=변동률, v=거래량, h=고가, l=저가, E=이벤트시간
  private handleTicker(data: Record<string, unknown>) {
    const now = Date.now()
    const eventTime = data.E as number  // 바이낸스 서버에서 데이터가 생성된 시간
    const ticker: TickerData = {
      symbol: (data.s as string).toUpperCase(),       // 심볼 (대문자)
      price: parseFloat(data.c as string),             // 현재 가격
      prevPrice: 0,                                     // 이전 가격 — 저장소에서 채워넣음
      change24h: parseFloat(data.P as string),          // 24시간 가격 변동률 (%)
      volume24h: parseFloat(data.v as string),          // 24시간 거래량
      high24h: parseFloat(data.h as string),            // 24시간 최고가
      low24h: parseFloat(data.l as string),             // 24시간 최저가
      latency: now - eventTime,                         // 지연 시간 (ms) — 데이터가 얼마나 빨리 도착했는지
      lastUpdate: now,                                  // 마지막 업데이트 시간
      source: this.name,                                // 데이터 출처 (binance)
    }
    // 콜백을 통해 저장소에 시세 데이터 전달
    this.onTicker?.(ticker)
  }

  // 연결 끊김 후 자동 재접속 스케줄링
  // 대기 시간을 2배씩 늘려감 (1초 → 2초 → 4초 → 8초 → 16초), 최대 5회 시도
  private scheduleReconnect() {
    if (this.reconnectTimer) return  // 이미 재접속 예약된 경우 중복 방지

    // 최대 재시도 횟수 초과 시 재연결 중단
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.warn('[TRAVIS] Binance WebSocket 연결 실패. 네트워크를 확인하세요. (최대 재시도 횟수 초과)')
      this.setStatus('disconnected')
      return
    }

    this.reconnectAttempts++
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY)
      this.connect()  // 재접속 시도
    }, this.reconnectDelay)
  }

  // 연결 상태 변경 및 외부 콜백 호출
  private setStatus(status: ConnectionStatus) {
    this.status = status
    this.onStatusChange?.(status)  // 상태 변경을 구독자에게 알림
  }
}
