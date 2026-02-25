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

// --- Edge connections between nodes ---
export type EdgeStrength = 'strong' | 'weak' | 'speculative'

export interface EdgeData {
  id: string
  fromNodeId: string
  toNodeId: string
  strength: EdgeStrength
  label?: string
  animated?: boolean
}

// --- Real-time data ---
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting'

export interface TickerData {
  symbol: string
  price: number
  prevPrice: number
  change24h: number
  volume24h: number
  high24h: number
  low24h: number
  latency: number
  lastUpdate: number
  source: string
}

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

// --- Feed ---
export type FeedCategory = 'macro' | 'crypto' | 'onchain' | 'exchange' | 'social' | 'stocks' | 'world'
export type FeedImportance = 'critical' | 'alert' | 'signal' | 'info'

export interface FeedItem {
  id: string
  title: string
  source: string
  url: string
  category: FeedCategory
  importance: FeedImportance
  timestamp: number
  summary?: string
  location?: string
  aiImportance?: FeedImportance   // AI가 재평가한 중요도
  relevanceScore?: number          // 0-100, 유저 컨텍스트 대비 관련성
  scored?: boolean                 // scoring 완료 여부
}
