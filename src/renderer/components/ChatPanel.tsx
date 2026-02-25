import { useState, useRef, useEffect } from 'react'
import { useChatStore } from '../stores/useChatStore'
import { useSettingsStore } from '../stores/useSettingsStore'
import { useCanvasStore } from '../stores/useCanvasStore'
import { sendMessage } from '../services/claude'
import SettingsModal from './SettingsModal'

export default function ChatPanel() {
  const messages = useChatStore((s) => s.messages)
  const addMessage = useChatStore((s) => s.addMessage)
  const isLoading = useChatStore((s) => s.isLoading)
  const setLoading = useChatStore((s) => s.setLoading)
  const [input, setInput] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 새 메시지 시 자동 스크롤
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || isLoading) return

    const { apiKey, model, contextPrompt, tavilyApiKey } = useSettingsStore.getState()
    if (!apiKey) {
      setSettingsOpen(true)
      return
    }

    addMessage('user', trimmed)
    setInput('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    setLoading(true)
    try {
      const cards = useCanvasStore.getState().cards
      const canvasCards = cards.map((c) => ({
        id: c.id,
        title: c.title,
        type: c.type,
      }))

      const result = await sendMessage(trimmed, {
        apiKey,
        model,
        contextPrompt,
        tavilyApiKey,
        canvasCards,
      })

      addMessage('assistant', result.text || '(도구를 실행했습니다)')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류'
      addMessage('assistant', `오류: ${message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  return (
    <>
      <div className="w-80 h-full flex flex-col bg-deep border-l border-white/5">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <span className="text-sm font-bold tracking-wider bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent font-rajdhani">
            TRAVIS
          </span>
          <button
            onClick={() => setSettingsOpen(true)}
            className="text-t3 hover:text-t2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && !isLoading && (
            <div className="flex items-center justify-center h-full">
              <p className="text-t4 text-xs font-mono">메시지를 입력하세요...</p>
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-purple-500/20 text-purple-100 rounded-br-sm'
                    : 'bg-white/5 text-t2 rounded-bl-sm'
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {/* 로딩 인디케이터 */}
          {isLoading && (
            <div className="flex justify-start">
              <div className="px-3 py-2.5 rounded-lg bg-white/5 rounded-bl-sm">
                <div className="flex gap-1 items-center">
                  <span className="typing-dot w-1.5 h-1.5 rounded-full bg-purple-400" style={{ animationDelay: '0s' }} />
                  <span className="typing-dot w-1.5 h-1.5 rounded-full bg-purple-400" style={{ animationDelay: '0.2s' }} />
                  <span className="typing-dot w-1.5 h-1.5 rounded-full bg-purple-400" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-3 py-3 border-t border-white/5">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="메시지를 입력하세요..."
              rows={1}
              disabled={isLoading}
              className="flex-1 bg-white/5 text-sm text-t1 placeholder-t4 px-3 py-2 rounded-lg border border-white/5 focus:border-purple-500/50 focus:outline-none resize-none font-mono disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="p-2 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  )
}
