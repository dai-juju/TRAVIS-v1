// AI 뉴스 스코어링 서비스 — Claude AI를 사용해 뉴스 중요도를 자동 평가
// 각 뉴스 헤드라인을 AI에게 보내면 중요도(critical/alert/signal/info)와 관련성 점수(0-100)를 매김

// 뉴스 아이템과 중요도 타입 가져오기
import type { FeedItem, FeedImportance } from '../types'
// 설정 저장소 — API 키와 AI 스코어링 활성화 여부 확인용
import { useSettingsStore } from '../stores/useSettingsStore'
// 피드 저장소 — AI가 평가한 점수를 뉴스에 반영하기 위해
import { useFeedStore } from '../stores/useFeedStore'

// 스코어링에 사용할 AI 모델 (빠르고 저렴한 Haiku 사용 — 대량 처리에 적합)
const SCORING_MODEL = 'claude-haiku-4-5-20251001'
const BATCH_SIZE = 5       // 이 개수 이상 모이면 즉시 배치 처리
const MAX_BATCH = 10       // 한 번에 AI에게 보내는 최대 뉴스 개수
const TIMER_MS = 10_000    // 10초 타이머 — 뉴스가 적어도 10초마다 한 번씩 평가

// AI에게 보내는 시스템 프롬프트 — "너는 뉴스 중요도 분류기야" 라고 지시
// 중요도 기준:
//   critical = 시장을 움직이는 이벤트 (해킹, 폭락, 대형 규제, 연준 결정)
//   alert = 중요하지만 즉각적이지 않은 (고래 움직임, 대형 파트너십)
//   signal = 주목할 만한 정보 (거래소 상장, 프로토콜 업데이트)
//   info = 일상적/영향 적은 (사소한 업데이트, 의견 기사)
const SYSTEM_PROMPT = `You are a trading news importance classifier.
Rate each news headline. Respond ONLY with a JSON array.
Each element: {"id": "<id>", "importance": "<level>", "score": <number>}
- importance: "critical" | "alert" | "signal" | "info"
- score: 0-100 relevance to the trader's context
Criteria:
  critical = market-moving event (hack, crash, major regulation, Fed decision)
  alert = significant but not immediate (whale move, major partnership, earnings surprise)
  signal = notable information (exchange listing, protocol update, analyst opinion)
  info = routine/low-impact (minor update, opinion piece, old news)`

// AI 스코어링 결과 구조
interface ScoringResult {
  id: string                    // 뉴스 아이템 ID
  importance: FeedImportance    // AI가 평가한 중요도
  score: number                 // 관련성 점수 (0-100)
}

// ====================================================================
// 스코어링 서비스 — 뉴스를 큐에 모아서 배치로 AI에게 중요도 평가를 요청
// 큐에 5개 이상 쌓이면 즉시 처리, 아니면 10초마다 한 번씩 처리
// ====================================================================
class ScoringService {
  private queue: FeedItem[] = []                                     // 평가 대기 중인 뉴스 큐
  private timer: ReturnType<typeof setTimeout> | null = null         // 배치 처리 타이머
  private processing = false                                         // 현재 배치 처리 중인지

  // 뉴스 아이템들을 평가 큐에 추가하는 함수
  enqueue(items: FeedItem[]) {
    // AI 스코어링이 꺼져있으면 무시
    const { enableAiScoring } = useSettingsStore.getState()
    if (!enableAiScoring) return

    // 아직 평가되지 않은 뉴스만 큐에 추가
    const unscored = items.filter((i) => i.scored !== true)
    if (unscored.length === 0) return

    this.queue.push(...unscored)

    // 큐에 5개 이상 쌓이면 즉시 배치 처리 시작
    if (this.queue.length >= BATCH_SIZE) {
      this.processBatch()
    } else if (!this.timer) {
      // 아직 5개 미만이면 10초 후에 처리 (소량이라도 너무 오래 기다리지 않도록)
      this.timer = setTimeout(() => {
        this.timer = null
        this.processBatch()
      }, TIMER_MS)
    }
  }

  // 큐에 쌓인 뉴스를 묶어서 AI에게 중요도 평가 요청 (배치 처리)
  private async processBatch() {
    if (this.processing) return       // 이미 처리 중이면 중복 실행 방지
    if (this.queue.length === 0) return  // 큐가 비어있으면 할 일 없음

    const { apiKey, enableAiScoring, contextPrompt } = useSettingsStore.getState()
    // API 키가 없거나 AI 스코어링이 꺼져있으면 큐 비우고 종료
    if (!apiKey || !enableAiScoring) {
      this.queue = []
      return
    }

    this.processing = true
    // 큐에서 최대 10개를 꺼내서 배치로 처리
    const batch = this.queue.splice(0, MAX_BATCH)

    try {
      // 뉴스 헤드라인을 번호 매겨서 텍스트로 구성
      const headlines = batch
        .map((item, i) => `${i + 1}. [${item.id}] ${item.title} — ${item.source}`)
        .join('\n')

      // 사용자 컨텍스트가 있으면 함께 전달 (예: "나는 BTC 롱 포지션 중" → BTC 관련 뉴스에 높은 점수)
      const userMessage = contextPrompt
        ? `Context: ${contextPrompt}\n\nHeadlines:\n${headlines}`
        : `Headlines:\n${headlines}`

      // Claude Haiku에게 뉴스 중요도 평가 요청
      const payload = {
        apiKey,
        model: SCORING_MODEL,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
        tools: [],  // 도구 없음 — 텍스트 응답만 필요
      }

      const response = await (window as any).api.sendChatMessage(payload)

      // AI 응답에서 텍스트(JSON 배열)를 추출하고 파싱
      const textBlock = response.content?.find((b: any) => b.type === 'text')
      if (textBlock?.text) {
        const results = this.parseResults(textBlock.text)
        if (results.length > 0) {
          // 파싱된 점수를 피드 저장소에 반영
          useFeedStore.getState().updateScoring(results)
        }
      }
    } catch (err) {
      console.warn('[ScoringService] batch scoring failed:', err)
    } finally {
      this.processing = false
      // 큐에 아직 뉴스가 남아있으면 다음 배치 처리 시작
      if (this.queue.length >= BATCH_SIZE) {
        this.processBatch()
      }
    }
  }

  // AI 응답 텍스트를 파싱하여 스코어링 결과 배열로 변환
  // AI가 항상 깔끔한 JSON을 반환하지 않을 수 있으므로 여러 방법으로 시도
  private parseResults(text: string): ScoringResult[] {
    // 전처리: ```json ... ``` 래핑 제거 (Haiku가 자주 이렇게 감싸서 보냄)
    let jsonStr = text.trim()
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '')
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '')
    }

    // 1차 시도: 전처리된 텍스트를 JSON으로 파싱
    try {
      const parsed = JSON.parse(jsonStr)
      if (Array.isArray(parsed)) return this.validateResults(parsed)
    } catch {
      // JSON.parse 실패 → JSON 배열/객체 부분만 추출하는 2차 시도
    }

    // 2차 시도(Fallback): 텍스트에서 JSON 배열 또는 객체 부분만 정규식으로 추출
    const match = jsonStr.match(/(\[[\s\S]*\]|\{[\s\S]*\})/)
    if (match) {
      try {
        const parsed = JSON.parse(match[1])
        if (Array.isArray(parsed)) return this.validateResults(parsed)
      } catch {
        // 2차 시도도 실패 — 아래에서 경고 로그 출력
      }
    }

    console.warn('[ScoringService] failed to parse response:', text.slice(0, 200))
    return []
  }

  // AI 응답 데이터의 유효성 검증 — 올바른 형식의 결과만 필터링
  private validateResults(arr: any[]): ScoringResult[] {
    const validImportances = new Set(['critical', 'alert', 'signal', 'info'])
    return arr
      .filter(
        (r) =>
          r &&
          typeof r.id === 'string' &&                    // ID가 문자열인지
          validImportances.has(r.importance) &&           // 중요도가 유효한 값인지
          typeof r.score === 'number'                     // 점수가 숫자인지
      )
      .map((r) => ({
        id: r.id,
        importance: r.importance as FeedImportance,
        score: Math.max(0, Math.min(100, Math.round(r.score))),  // 점수를 0-100 범위로 제한
      }))
  }

  // 스코어링 서비스 중지 — 타이머 취소, 큐 비우기
  stop() {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.queue = []
  }
}

// 스코어링 서비스의 싱글톤 인스턴스 — 앱 전체에서 하나만 사용
export const scoringService = new ScoringService()
