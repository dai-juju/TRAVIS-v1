/// <reference types="vite/client" />

interface Window {
  api: {
    sendChatMessage: (payload: {
      apiKey: string
      model: string
      system: string
      messages: unknown[]
      tools: unknown[]
    }) => Promise<{
      content: Array<
        | { type: 'text'; text: string }
        | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
      >
      stop_reason: string
    }>
  }
}
