import type { ToolCall, ApiMessage, ApiContentBlock, CardData } from '../types'
import { useCanvasStore } from '../stores/useCanvasStore'
import { useInvestigationStore } from '../stores/useInvestigationStore'
import { useChatStore } from '../stores/useChatStore'

// --- System Prompt ---
const BASE_SYSTEM_PROMPT = `You are TRAVIS, an AI assistant that helps users analyze cryptocurrency markets.
When the user asks anything, you should:
1. Understand their intent
2. Use your tools to spawn relevant information cards and websites on the canvas
3. Provide a brief text summary in chat

You can spawn multiple cards at once. Be generous with visual information.
Always think about what data would help the user understand the topic better.
Include relevant images, charts, and visual data in cards when helpful.
When spawning coin-related cards, always include the symbol parameter so they receive real-time price updates.

IMPORTANT — Symbol Field Rules:
When using spawn_card tool, the 'symbol' field must be the BASE symbol only, without any quote currency suffix. Examples:
- User says 'BTCUSDT 분석' → symbol: 'BTC' (not 'BTCUSDT')
- User says 'TRIAUSDT' → symbol: 'TRIA'
- User says '이더리움' → symbol: 'ETH'
- User says 'ETHBTC' → symbol: 'ETH'
- User says '비트코인' → symbol: 'BTC'
Never include USDT, BTC, BUSD, USD, KRW or any quote currency in the symbol field.

IMPORTANT — Card Connections:
When you spawn multiple related cards, use the relatedTo field to link them together.
The first card you spawn has no relatedTo. After it is spawned, you receive its cardId in the tool result.
Subsequent related cards should include relatedTo: [previousCardId] using that ID.
This creates visual connection lines between cards on the canvas, helping users see relationships.
Always link related cards — for example, if you spawn a BTC analysis card and then a BTC news card, the news card should reference the analysis card's ID.

CRITICAL — Web Search:
You MUST use the search_web tool when the user asks about recent news, current events, latest updates, or any time-sensitive information. Do NOT answer from memory for these topics — always search first, then answer based on results. You have the search_web tool available. Never say "I cannot search the web" or "I don't have access to current information" — you DO have search access. Use it proactively.

Respond in the same language the user uses.`

// --- Tool Definitions ---
const TOOLS = [
  {
    name: 'spawn_card',
    description:
      'Create an information card on the canvas. Use this to display analysis, data, summaries, comparisons, news, or price information. When spawning multiple related cards, link them using the relatedTo field with IDs from previously spawned cards.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Card header text' },
        content: {
          type: 'string',
          description: 'Card body content in Markdown format',
        },
        cardType: {
          type: 'string',
          enum: ['analysis', 'data', 'summary', 'comparison', 'news', 'price'],
          description: 'Type of card for styling',
        },
        symbol: {
          type: 'string',
          description:
            'Base trading symbol only (no quote currency). e.g. BTC, ETH, SOL, TRIA',
        },
        width: {
          type: 'number',
          description: 'Card width in pixels (default: 380)',
        },
        height: {
          type: 'number',
          description: 'Card height in pixels (default: auto)',
        },
        images: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              url: { type: 'string', description: 'Image URL' },
              caption: { type: 'string', description: 'Image caption' },
            },
            required: ['url'],
          },
          description: 'Optional images to display in the card',
        },
        relatedTo: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of card IDs that this card is related to. When spawning multiple cards about the same topic, link them together using this field. Use the cardId returned from previous spawn_card tool results.',
        },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'spawn_webview',
    description:
      'Embed a website on the canvas. Use for charts, exchanges, analytics platforms, etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        url: { type: 'string', description: 'Full URL to embed' },
        title: { type: 'string', description: 'Display title for the webview' },
        width: {
          type: 'number',
          description: 'Width in pixels (default: 900)',
        },
        height: {
          type: 'number',
          description: 'Height in pixels (default: 700)',
        },
      },
      required: ['url', 'title'],
    },
  },
  {
    name: 'remove_cards',
    description: 'Remove cards from the canvas.',
    input_schema: {
      type: 'object' as const,
      properties: {
        target: {
          type: 'string',
          description: '"all" to remove all cards, or a specific card ID',
        },
      },
      required: ['target'],
    },
  },
  {
    name: 'rearrange',
    description: 'Rearrange all cards on the canvas in a layout.',
    input_schema: {
      type: 'object' as const,
      properties: {
        layout: {
          type: 'string',
          enum: ['grid', 'stack'],
          description: 'Layout style',
        },
      },
      required: ['layout'],
    },
  },
  {
    name: 'update_card',
    description: 'Update the content of an existing card on the canvas.',
    input_schema: {
      type: 'object' as const,
      properties: {
        cardId: {
          type: 'string',
          description: 'ID of the card to update',
        },
        content: {
          type: 'string',
          description: 'New content in Markdown format',
        },
      },
      required: ['cardId', 'content'],
    },
  },
  {
    name: 'open_investigation',
    description:
      'Open Investigation Mode for a specific card — a full-screen 6-panel analysis dashboard.',
    input_schema: {
      type: 'object' as const,
      properties: {
        cardId: {
          type: 'string',
          description: 'ID of the card to investigate',
        },
      },
      required: ['cardId'],
    },
  },
  {
    name: 'search_web',
    description:
      'Search the web for current information, news, events, or data. Use this when you need up-to-date information that you may not have in your training data.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Search query',
        },
      },
      required: ['query'],
    },
  },
]

// --- Conversation History (API format, kept separate from display messages) ---
let conversationHistory: ApiMessage[] = []

function buildSystemPrompt(
  contextPrompt: string,
  canvasCards: Array<{ id: string; title: string; type: string }>,
  marketData?: string,
  focusedCard?: { title: string; content: string }
): string {
  let prompt = BASE_SYSTEM_PROMPT

  if (contextPrompt) {
    prompt += `\n\n[USER CONTEXT]\n${contextPrompt}`
  }

  if (marketData) {
    prompt += `\n\n[REAL-TIME MARKET DATA]\n${marketData}`
  }

  if (canvasCards.length > 0) {
    const list = canvasCards
      .map((c) => `- ${c.title} (${c.type}, id: ${c.id})`)
      .join('\n')
    prompt += `\n\n[CURRENT CANVAS STATE]\n${list}`
  } else {
    prompt += '\n\n[CURRENT CANVAS STATE]\nCanvas is empty.'
  }

  if (focusedCard) {
    const truncated = focusedCard.content.length > 2000
      ? focusedCard.content.slice(0, 2000) + '...'
      : focusedCard.content
    prompt += `\n\n[FOCUSED CARD CONTEXT]\nThe user is currently referencing a card titled "${focusedCard.title}". Answer their question in relation to this card's content:\n${truncated}`
  }

  return prompt
}

// --- Tool Execution ---
let spawnIndex = 0
let currentTavilyApiKey = ''

async function executeTool(
  toolName: string,
  input: Record<string, unknown>
): Promise<string> {
  const store = useCanvasStore.getState()

  switch (toolName) {
    case 'spawn_card': {
      const id = store.addCard({
        title: (input.title as string) || 'Card',
        content: (input.content as string) || '',
        cardType: input.cardType as string | undefined,
        symbol: input.symbol as string | undefined,
        width: (input.width as number) || 380,
        height: (input.height as number) || 280,
        images: input.images as Array<{ url: string; caption?: string }> | undefined,
        spawnDelay: spawnIndex * 0.15,
        type: 'card',
      })
      spawnIndex++

      // 관련 카드와 엣지 자동 생성
      const relatedTo = input.relatedTo as string[] | undefined
      if (relatedTo && relatedTo.length > 0) {
        const latestStore = useCanvasStore.getState()
        for (const targetId of relatedTo) {
          const targetExists = latestStore.cards.some((c) => c.id === targetId)
          if (targetExists) {
            latestStore.addEdge(id, targetId, 'weak')
          }
        }
      }

      return JSON.stringify({ status: 'spawned', cardId: id })
    }

    case 'spawn_webview': {
      const id = store.addWebview({
        url: (input.url as string) || '',
        title: (input.title as string) || 'Webview',
        width: (input.width as number) || 600,
        height: (input.height as number) || 450,
        type: 'webview',
      })
      return JSON.stringify({ status: 'spawned', cardId: id })
    }

    case 'remove_cards': {
      const target = input.target as string
      if (target === 'all') {
        store.removeAllCards()
      } else {
        store.removeCard(target)
      }
      return JSON.stringify({ status: 'removed' })
    }

    case 'rearrange': {
      const layout = input.layout as 'grid' | 'stack'
      store.rearrangeCards(layout)
      return JSON.stringify({ status: 'rearranged' })
    }

    case 'update_card': {
      const cardId = input.cardId as string
      const content = input.content as string
      store.updateCardContent(cardId, content)
      return JSON.stringify({ status: 'updated', cardId })
    }

    case 'open_investigation': {
      const cardId = input.cardId as string
      const card = store.cards.find((c) => c.id === cardId && c.type === 'card') as CardData | undefined
      if (card) {
        useInvestigationStore.getState().open(card)
        return JSON.stringify({ status: 'opened', cardId })
      }
      return JSON.stringify({ status: 'error', message: 'Card not found' })
    }

    case 'search_web': {
      const query = input.query as string
      console.log('[TRAVIS] search_web called — query:', query, '| apiKey set:', !!currentTavilyApiKey)
      const api = (window as any).api
      if (!api?.searchWeb) {
        return JSON.stringify({ status: 'error', message: 'Search bridge not available' })
      }
      const result = await api.searchWeb(query, currentTavilyApiKey)
      console.log('[TRAVIS] search_web result length:', typeof result === 'string' ? result.length : 0)
      return JSON.stringify({ status: 'success', results: result })
    }

    default:
      return JSON.stringify({ status: 'unknown_tool' })
  }
}

// --- Streaming ---

interface StreamRoundResult {
  text: string
  toolUseBlocks: Array<{ id: string; name: string; input: Record<string, unknown> }>
  stopReason: string
  fullContent: ApiContentBlock[]
}

function streamOneRound(
  payload: { apiKey: string; model: string; system: string; messages: ApiMessage[]; tools: unknown[] },
  messageId: string,
  existingText: string,
): Promise<StreamRoundResult> {
  return new Promise((resolve, reject) => {
    const api = (window as any).api
    let accumulatedText = ''
    let stopReason = ''

    // tool_use 블록 추적
    const toolBlocks: Map<number, { id: string; name: string; jsonStr: string }> = new Map()

    const cleanups: Array<() => void> = []

    function cleanup() {
      for (const fn of cleanups) fn()
      cleanups.length = 0
    }

    let resolved = false

    // text-delta
    cleanups.push(api.onStreamEvent('stream:text-delta', (data: { text: string }) => {
      accumulatedText += data.text
      useChatStore.getState().updateMessage(messageId, existingText + accumulatedText)
    }))

    // tool-start
    cleanups.push(api.onStreamEvent('stream:tool-start', (data: { index: number; id: string; name: string }) => {
      toolBlocks.set(data.index, { id: data.id, name: data.name, jsonStr: '' })
    }))

    // tool-delta
    cleanups.push(api.onStreamEvent('stream:tool-delta', (data: { index: number; json: string }) => {
      const block = toolBlocks.get(data.index)
      if (block) {
        block.jsonStr += data.json
      }
    }))

    // tool-end (no-op, JSON finalized on message-delta/end)
    cleanups.push(api.onStreamEvent('stream:tool-end', (_data: { index: number }) => {
      // tool block finalized
    }))

    // message-delta
    cleanups.push(api.onStreamEvent('stream:message-delta', (data: { stopReason: string }) => {
      stopReason = data.stopReason || ''
    }))

    // stream:end
    cleanups.push(api.onStreamEvent('stream:end', () => {
      if (resolved) return
      resolved = true
      cleanup()

      // fullContent 구성
      const fullContent: ApiContentBlock[] = []
      if (accumulatedText) {
        fullContent.push({ type: 'text', text: accumulatedText })
      }

      const toolUseBlocks: Array<{ id: string; name: string; input: Record<string, unknown> }> = []
      for (const [, block] of toolBlocks) {
        let parsedInput: Record<string, unknown> = {}
        try {
          parsedInput = JSON.parse(block.jsonStr || '{}')
        } catch {
          // 빈 입력
        }
        toolUseBlocks.push({ id: block.id, name: block.name, input: parsedInput })
        fullContent.push({ type: 'tool_use', id: block.id, name: block.name, input: parsedInput })
      }

      resolve({ text: accumulatedText, toolUseBlocks, stopReason, fullContent })
    }))

    // stream:error
    cleanups.push(api.onStreamEvent('stream:error', (data: { error: string }) => {
      if (resolved) return
      resolved = true
      cleanup()
      reject(new Error(data.error))
    }))

    // 스트리밍 시작 (fire-and-forget)
    api.startChatStream(payload)
  })
}

// --- Main API ---
export interface SendMessageOptions {
  apiKey: string
  model: string
  contextPrompt: string
  tavilyApiKey: string
  canvasCards: Array<{ id: string; title: string; type: string }>
  focusedCard?: { id: string; title: string; content: string }
}

export interface SendMessageResult {
  text: string
  toolCalls: ToolCall[]
}

// 유저 메시지에서 코인 심볼 추출 → Binance REST API로 시세 fetch
const KNOWN_SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'DOT', 'AVAX', 'MATIC']
const SYMBOL_REGEX = new RegExp(`\\b(${KNOWN_SYMBOLS.join('|')})\\b`, 'gi')

async function fetchMarketData(message: string): Promise<string | undefined> {
  const matches = message.toUpperCase().match(SYMBOL_REGEX)
  if (!matches) return undefined

  const unique = [...new Set(matches.map((m) => m.toUpperCase()))]
  const lines: string[] = []

  await Promise.allSettled(
    unique.map(async (sym) => {
      try {
        const res = await fetch(
          `https://api.binance.com/api/v3/ticker/24hr?symbol=${sym}USDT`
        )
        if (!res.ok) return
        const d = await res.json()
        const price = parseFloat(d.lastPrice)
        const change = parseFloat(d.priceChangePercent)
        const vol = parseFloat(d.volume)
        lines.push(
          `${sym}/USDT: $${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: price < 10 ? 4 : 2 })} | 24h: ${change >= 0 ? '+' : ''}${change.toFixed(2)}% | Vol: ${vol.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${sym}`
        )
      } catch {
        // 개별 심볼 실패 무시
      }
    })
  )

  return lines.length > 0 ? lines.join('\n') : undefined
}

export async function sendMessage(
  userMessage: string,
  options: SendMessageOptions
): Promise<SendMessageResult> {
  const { apiKey, model, contextPrompt, tavilyApiKey, canvasCards, focusedCard } = options

  // Tavily API key를 executeTool에서 사용하도록 저장
  currentTavilyApiKey = tavilyApiKey
  console.log('[TRAVIS] sendMessage — tavilyApiKey set:', tavilyApiKey ? 'YES' : 'NO', '| tools count:', TOOLS.length)

  conversationHistory.push({ role: 'user', content: userMessage })

  // 실시간 시세 주입
  const marketData = await fetchMarketData(userMessage)
  const systemPrompt = buildSystemPrompt(contextPrompt, canvasCards, marketData, focusedCard)
  const allToolCalls: ToolCall[] = []

  // 스폰 인덱스 초기화 (새 메시지마다 cascade delay 리셋)
  spawnIndex = 0

  // 빈 assistant 메시지 생성 → 스트리밍 대상
  const chatStore = useChatStore.getState()
  const messageId = chatStore.addMessage('assistant', '')
  chatStore.setStreamingMessageId(messageId)

  let accumulatedText = ''

  // Multi-turn loop (tool_use → tool_result → 반복)
  let turns = 0
  const maxTurns = 10

  try {
    while (turns++ < maxTurns) {
      const result = await streamOneRound(
        { apiKey, model, system: systemPrompt, messages: conversationHistory, tools: TOOLS },
        messageId,
        accumulatedText,
      )

      accumulatedText = accumulatedText + result.text

      // assistant 응답을 히스토리에 추가
      conversationHistory.push({
        role: 'assistant',
        content: result.fullContent,
      })

      // tool calls 기록
      for (const block of result.toolUseBlocks) {
        allToolCalls.push({ id: block.id, name: block.name, input: block.input })
      }

      // tool_use가 아니면 완료
      if (result.stopReason !== 'tool_use' || result.toolUseBlocks.length === 0) {
        break
      }

      // 도구 실행 + tool_result 전송
      const toolResults: ApiContentBlock[] = []
      for (const block of result.toolUseBlocks) {
        const toolResult = await executeTool(block.name, block.input)
        toolResults.push({
          type: 'tool_result' as const,
          tool_use_id: block.id,
          content: toolResult,
        })
      }
      conversationHistory.push({ role: 'user', content: toolResults })

      // 다음 라운드에서 텍스트가 이어서 추가됨
      if (accumulatedText) accumulatedText += '\n\n'
    }
  } finally {
    useChatStore.getState().setStreamingMessageId(null)
  }

  // 최종 메시지가 비어있으면 "(도구를 실행했습니다)" 표시
  if (!accumulatedText.trim()) {
    useChatStore.getState().updateMessage(messageId, '(도구를 실행했습니다)')
  }

  return { text: accumulatedText, toolCalls: allToolCalls }
}

export function clearConversation() {
  conversationHistory = []
}
