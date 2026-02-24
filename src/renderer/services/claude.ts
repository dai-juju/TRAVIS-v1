import type { ToolCall, ApiMessage, ApiContentBlock, CardData } from '../types'
import { useCanvasStore } from '../stores/useCanvasStore'
import { useInvestigationStore } from '../stores/useInvestigationStore'

// --- System Prompt ---
const BASE_SYSTEM_PROMPT = `You are TRAVIS, an AI assistant that helps users analyze cryptocurrency markets.
When the user asks anything, you should:
1. Understand their intent
2. Use your tools to spawn relevant information cards and websites on the canvas
3. Provide a brief text summary in chat

You can spawn multiple cards at once. Be generous with visual information.
Always think about what data would help the user understand the topic better.
Include relevant images, charts, and visual data in cards when helpful.
When spawning coin-related cards, include the symbol parameter (e.g. "BTCUSDT") so they receive real-time price updates.
Respond in the same language the user uses.`

// --- Tool Definitions ---
const TOOLS = [
  {
    name: 'spawn_card',
    description:
      'Create an information card on the canvas. Use this to display analysis, data, summaries, comparisons, news, or price information.',
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
            'Trading symbol for real-time data, e.g. BTCUSDT, ETHUSDT',
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
]

// --- Conversation History (API format, kept separate from display messages) ---
let conversationHistory: ApiMessage[] = []

function buildSystemPrompt(
  contextPrompt: string,
  canvasCards: Array<{ id: string; title: string; type: string }>
): string {
  let prompt = BASE_SYSTEM_PROMPT

  if (contextPrompt) {
    prompt += `\n\n[USER CONTEXT]\n${contextPrompt}`
  }

  if (canvasCards.length > 0) {
    const list = canvasCards
      .map((c) => `- ${c.title} (${c.type}, id: ${c.id})`)
      .join('\n')
    prompt += `\n\n[CURRENT CANVAS STATE]\n${list}`
  } else {
    prompt += '\n\n[CURRENT CANVAS STATE]\nCanvas is empty.'
  }

  return prompt
}

// --- Tool Execution ---
let spawnIndex = 0

function executeTool(
  toolName: string,
  input: Record<string, unknown>
): string {
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

    default:
      return JSON.stringify({ status: 'unknown_tool' })
  }
}

// --- Main API ---
export interface SendMessageOptions {
  apiKey: string
  model: string
  contextPrompt: string
  canvasCards: Array<{ id: string; title: string; type: string }>
}

export interface SendMessageResult {
  text: string
  toolCalls: ToolCall[]
}

export async function sendMessage(
  userMessage: string,
  options: SendMessageOptions
): Promise<SendMessageResult> {
  const { apiKey, model, contextPrompt, canvasCards } = options

  conversationHistory.push({ role: 'user', content: userMessage })

  const systemPrompt = buildSystemPrompt(contextPrompt, canvasCards)
  const allToolCalls: ToolCall[] = []
  let finalText = ''

  // 스폰 인덱스 초기화 (새 메시지마다 cascade delay 리셋)
  spawnIndex = 0

  // Multi-turn loop (tool_use → tool_result → 반복)
  let turns = 0
  const maxTurns = 10

  while (turns++ < maxTurns) {
    const response = await window.api.sendChatMessage({
      apiKey,
      model,
      system: systemPrompt,
      messages: conversationHistory,
      tools: TOOLS,
    })

    const content = response.content
    if (!Array.isArray(content)) {
      throw new Error('Unexpected API response format')
    }

    // 텍스트와 tool_use 분리
    const textParts: string[] = []
    const toolUseBlocks: Array<{
      type: 'tool_use'
      id: string
      name: string
      input: Record<string, unknown>
    }> = []

    for (const block of content) {
      if (block.type === 'text') {
        textParts.push(block.text)
      } else if (block.type === 'tool_use') {
        toolUseBlocks.push(block)
        allToolCalls.push({
          id: block.id,
          name: block.name,
          input: block.input,
        })
      }
    }

    // Assistant 응답을 히스토리에 추가
    conversationHistory.push({
      role: 'assistant',
      content: content as ApiContentBlock[],
    })

    // tool_use가 없으면 완료
    if (response.stop_reason !== 'tool_use' || toolUseBlocks.length === 0) {
      finalText = textParts.join('\n')
      break
    }

    // 도구 실행 + tool_result 전송
    const toolResults: ApiContentBlock[] = toolUseBlocks.map((block) => ({
      type: 'tool_result' as const,
      tool_use_id: block.id,
      content: executeTool(block.name, block.input),
    }))
    conversationHistory.push({ role: 'user', content: toolResults })
  }

  return { text: finalText, toolCalls: allToolCalls }
}

export function clearConversation() {
  conversationHistory = []
}
