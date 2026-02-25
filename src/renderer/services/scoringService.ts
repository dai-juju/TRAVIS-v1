import type { FeedItem, FeedImportance } from '../types'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useFeedStore } from '../stores/useFeedStore'

const SCORING_MODEL = 'claude-haiku-4-5-20251001'
const BATCH_SIZE = 5
const MAX_BATCH = 10
const TIMER_MS = 10_000

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

interface ScoringResult {
  id: string
  importance: FeedImportance
  score: number
}

class ScoringService {
  private queue: FeedItem[] = []
  private timer: ReturnType<typeof setTimeout> | null = null
  private processing = false

  enqueue(items: FeedItem[]) {
    const { enableAiScoring } = useSettingsStore.getState()
    if (!enableAiScoring) return

    const unscored = items.filter((i) => i.scored !== true)
    if (unscored.length === 0) return

    this.queue.push(...unscored)

    if (this.queue.length >= BATCH_SIZE) {
      this.processBatch()
    } else if (!this.timer) {
      this.timer = setTimeout(() => {
        this.timer = null
        this.processBatch()
      }, TIMER_MS)
    }
  }

  private async processBatch() {
    if (this.processing) return
    if (this.queue.length === 0) return

    const { apiKey, enableAiScoring, contextPrompt } = useSettingsStore.getState()
    if (!apiKey || !enableAiScoring) {
      this.queue = []
      return
    }

    this.processing = true
    const batch = this.queue.splice(0, MAX_BATCH)

    try {
      const headlines = batch
        .map((item, i) => `${i + 1}. [${item.id}] ${item.title} — ${item.source}`)
        .join('\n')

      const userMessage = contextPrompt
        ? `Context: ${contextPrompt}\n\nHeadlines:\n${headlines}`
        : `Headlines:\n${headlines}`

      const payload = {
        apiKey,
        model: SCORING_MODEL,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
        tools: [],
      }

      const response = await (window as any).api.sendChatMessage(payload)

      const textBlock = response.content?.find((b: any) => b.type === 'text')
      if (textBlock?.text) {
        const results = this.parseResults(textBlock.text)
        if (results.length > 0) {
          useFeedStore.getState().updateScoring(results)
        }
      }
    } catch (err) {
      console.warn('[ScoringService] batch scoring failed:', err)
    } finally {
      this.processing = false
      // 큐에 남은 아이템이 있으면 다음 배치 처리
      if (this.queue.length >= BATCH_SIZE) {
        this.processBatch()
      }
    }
  }

  private parseResults(text: string): ScoringResult[] {
    try {
      const parsed = JSON.parse(text)
      if (Array.isArray(parsed)) return this.validateResults(parsed)
    } catch {
      // JSON.parse 실패 → 정규식 fallback
    }

    const match = text.match(/\[[\s\S]*\]/)
    if (match) {
      try {
        const parsed = JSON.parse(match[0])
        if (Array.isArray(parsed)) return this.validateResults(parsed)
      } catch {
        // fallback도 실패
      }
    }

    console.warn('[ScoringService] failed to parse response:', text)
    return []
  }

  private validateResults(arr: any[]): ScoringResult[] {
    const validImportances = new Set(['critical', 'alert', 'signal', 'info'])
    return arr
      .filter(
        (r) =>
          r &&
          typeof r.id === 'string' &&
          validImportances.has(r.importance) &&
          typeof r.score === 'number'
      )
      .map((r) => ({
        id: r.id,
        importance: r.importance as FeedImportance,
        score: Math.max(0, Math.min(100, Math.round(r.score))),
      }))
  }

  stop() {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.queue = []
  }
}

export const scoringService = new ScoringService()
