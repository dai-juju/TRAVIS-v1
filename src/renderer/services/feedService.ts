// 뉴스 피드 서비스 — 여러 뉴스 소스에서 최신 뉴스를 자동으로 가져오는 서비스
// 정해진 주기마다 뉴스를 폴링(반복 조회)하여 피드 저장소에 전달

// 뉴스 아이템 타입 가져오기
import type { FeedItem } from '../types'
// 뉴스 제목에서 지역(국가/도시) 정보를 추출하는 유틸리티
import { extractLocation } from '../utils/geoKeywords'

// 뉴스 소스 인터페이스 — 각 뉴스 소스가 따라야 하는 규격
interface FeedSource {
  name: string                     // 소스 이름 (예: 'CryptoCompare')
  interval: number                 // 뉴스 가져오는 주기 (밀리초 단위)
  fetch(): Promise<FeedItem[]>    // 뉴스를 가져오는 함수
}

// --- CryptoCompare 뉴스 소스 ---
// CryptoCompare API에서 암호화폐 뉴스를 60초마다 가져옴
const cryptoNewsSource: FeedSource = {
  name: 'CryptoCompare',
  interval: 60_000,  // 60초(1분)마다 새 뉴스 확인
  async fetch(): Promise<FeedItem[]> {
    const raw: Array<{
      title: string
      url: string
      source: string
      body: string
      timestamp: number
      categories: string
    }> = await (window as unknown as { api: Record<string, Function> }).api.fetchCryptoNews()

    // 원시 뉴스 데이터를 우리 시스템의 FeedItem 형식으로 변환
    return raw.map((item, i) => {
      // 뉴스 카테고리를 키워드 기반으로 자동 분류
      const cats = item.categories.toLowerCase()
      const isExchange = cats.includes('exchange')                                    // 거래소 관련
      const isRegulation = cats.includes('regulation') || cats.includes('government') // 규제/정부 관련
      const isMining = cats.includes('mining') || cats.includes('blockchain')         // 채굴/블록체인 관련

      // 카테고리 결정 (기본값: crypto)
      let category: FeedItem['category'] = 'crypto'
      if (isExchange) category = 'exchange'
      else if (isRegulation) category = 'macro'
      else if (isMining) category = 'onchain'

      return {
        id: `cn-${item.timestamp}-${i}`,         // 고유 ID 생성
        title: item.title,
        source: item.source,
        url: item.url,
        category,                                  // 자동 분류된 카테고리
        importance: 'signal' as const,             // 기본 중요도 (나중에 AI가 재평가)
        timestamp: item.timestamp,
        summary: item.body,
        location: extractLocation(item.title, item.source)?.name,  // 뉴스에서 지역 정보 추출
      }
    })
  },
}

// --- 공포&탐욕 지수 소스 ---
// 암호화폐 시장의 심리 지표 (0=극단적 공포, 100=극단적 탐욕)
// 5분마다 업데이트 — 시장 심리를 파악하는 중요한 보조 지표
const fearGreedSource: FeedSource = {
  name: 'FearGreed',
  interval: 300_000,  // 300초(5분)마다 업데이트
  async fetch(): Promise<FeedItem[]> {
    // Alternative.me API에서 공포&탐욕 지수 가져오기
    const data: { value: number; classification: string; timestamp: number } | null =
      await (window as unknown as { api: Record<string, Function> }).api.fetchFearGreed()

    if (!data) return []  // 데이터를 못 가져오면 빈 배열 반환

    // 극단값(25 이하 또는 75 이상)이면 'alert'(경보), 아니면 'signal'(신호)
    const importance = data.value <= 25 || data.value >= 75 ? 'alert' as const : 'signal' as const

    return [{
      id: `fng-${data.timestamp}`,
      title: `Fear & Greed Index: ${data.value} (${data.classification})`,
      source: 'Alternative.me',
      url: 'https://alternative.me/crypto/fear-and-greed-index/',
      category: 'crypto' as const,
      importance,
      timestamp: data.timestamp,
    }]
  },
}

// ====================================================================
// 피드 서비스 매니저 — 모든 뉴스 소스를 통합 관리하는 중앙 관리자
// 각 소스의 폴링 타이머를 관리하고, 새 뉴스가 들어오면 구독자들에게 알림
// ====================================================================
class FeedServiceManager {
  private sources: FeedSource[] = [cryptoNewsSource, fearGreedSource]  // 등록된 뉴스 소스 목록
  private listeners = new Set<(items: FeedItem[]) => void>()           // 뉴스 업데이트 구독자 목록
  private timers: ReturnType<typeof setInterval>[] = []                // 폴링 타이머 목록
  private allItems = new Map<string, FeedItem>()                       // 전체 뉴스 아이템 (ID별 저장)

  // 모든 뉴스 소스의 자동 폴링 시작
  startAll() {
    for (const source of this.sources) {
      // 각 소스별 뉴스 가져오기 함수
      const run = async () => {
        try {
          const items = await source.fetch()
          // 가져온 뉴스를 전체 목록에 추가 (같은 ID면 최신으로 덮어씀)
          for (const item of items) {
            this.allItems.set(item.id, item)
          }
          // 구독자들에게 새 뉴스가 있음을 알림
          this.notify()
        } catch (err) {
          console.error(`[feedService] ${source.name} failed:`, err)
        }
      }

      // 시작하자마자 즉시 1번 가져오고, 이후 주기적으로 반복
      run()
      this.timers.push(setInterval(run, source.interval))
    }
  }

  // 모든 폴링 타이머 중지
  stopAll() {
    for (const timer of this.timers) clearInterval(timer)
    this.timers = []
  }

  // 뉴스 업데이트 구독 — 새 뉴스가 들어올 때마다 콜백 함수 호출
  // 반환값은 구독 해제 함수
  onUpdate(callback: (items: FeedItem[]) => void): () => void {
    this.listeners.add(callback)
    return () => this.listeners.delete(callback)  // 구독 해제 함수 반환
  }

  // 모든 구독자에게 전체 뉴스 목록을 최신순으로 정렬하여 전달
  private notify() {
    const items = Array.from(this.allItems.values())
      .sort((a, b) => b.timestamp - a.timestamp)  // 최신 뉴스가 먼저
    for (const listener of this.listeners) {
      listener(items)
    }
  }
}

// 피드 서비스의 싱글톤 인스턴스 — 앱 전체에서 하나만 사용
export const feedService = new FeedServiceManager()
