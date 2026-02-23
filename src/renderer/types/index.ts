// --- Tool call parsed from Claude response ---
export interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

// --- Canvas items ---
export interface CardData {
  id: string
  type: 'card'
  title: string
  content: string
  cardType?: string
  symbol?: string
  images?: Array<{ url: string; caption?: string }>
  x: number
  y: number
  width: number
  height: number
  spawnDelay?: number
}

export interface WebviewData {
  id: string
  type: 'webview'
  url: string
  title: string
  x: number
  y: number
  width: number
  height: number
}

export type CanvasItem = CardData | WebviewData

// --- Claude API message format ---
export type ApiContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string }

export interface ApiMessage {
  role: 'user' | 'assistant'
  content: string | ApiContentBlock[]
}

// --- IPC payload / response ---
export interface ChatPayload {
  apiKey: string
  model: string
  system: string
  messages: ApiMessage[]
  tools: unknown[]
}

export interface ChatResponse {
  content: ApiContentBlock[]
  stop_reason: string
}
