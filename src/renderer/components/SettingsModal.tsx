import { useState, useEffect } from 'react'
import { useSettingsStore } from '../stores/useSettingsStore'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { apiKey, tavilyApiKey, contextPrompt, model, enableAiScoring, setApiKey, setTavilyApiKey, setContextPrompt, setModel, setEnableAiScoring } =
    useSettingsStore()

  const [localKey, setLocalKey] = useState(apiKey)
  const [localTavilyKey, setLocalTavilyKey] = useState(tavilyApiKey)
  const [localPrompt, setLocalPrompt] = useState(contextPrompt)
  const [localModel, setLocalModel] = useState(model)

  // 모달 열릴 때 현재 값으로 초기화
  useEffect(() => {
    if (isOpen) {
      setLocalKey(apiKey)
      setLocalTavilyKey(tavilyApiKey)
      setLocalPrompt(contextPrompt)
      setLocalModel(model)
    }
  }, [isOpen, apiKey, tavilyApiKey, contextPrompt, model])

  // ESC로 닫기
  useEffect(() => {
    if (!isOpen) return
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleSave = () => {
    setApiKey(localKey.trim())
    setTavilyApiKey(localTavilyKey.trim())
    setContextPrompt(localPrompt)
    setModel(localModel)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative bg-card border border-white/5 rounded-xl p-6 w-[420px] max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-t1 font-rajdhani">Settings</h2>
          <button
            onClick={onClose}
            className="text-t3 hover:text-t2 transition-colors text-lg"
          >
            ✕
          </button>
        </div>

        {/* API Key */}
        <div className="mb-5">
          <label className="block text-sm text-t2 mb-1.5">API Key</label>
          <input
            type="password"
            value={localKey}
            onChange={(e) => setLocalKey(e.target.value)}
            placeholder="sk-ant-..."
            className="w-full bg-white/5 text-sm text-t1 placeholder-t4 px-3 py-2 rounded-lg border border-white/5 focus:border-purple-500/50 focus:outline-none font-mono"
          />
        </div>

        {/* Tavily API Key */}
        <div className="mb-5">
          <label className="block text-sm text-t2 mb-1.5">Tavily API Key <span className="text-t4">(web search)</span></label>
          <input
            type="password"
            value={localTavilyKey}
            onChange={(e) => setLocalTavilyKey(e.target.value)}
            placeholder="tvly-..."
            className="w-full bg-white/5 text-sm text-t1 placeholder-t4 px-3 py-2 rounded-lg border border-white/5 focus:border-purple-500/50 focus:outline-none font-mono"
          />
        </div>

        {/* Context Prompt */}
        <div className="mb-5">
          <label className="block text-sm text-t2 mb-1.5">
            Context Prompt
          </label>
          <textarea
            value={localPrompt}
            onChange={(e) => setLocalPrompt(e.target.value)}
            placeholder="예: 나는 바이낸스 선물에서 주로 BTC, ETH, SOL을 거래해. 단타 위주야."
            rows={3}
            className="w-full bg-white/5 text-sm text-t1 placeholder-t4 px-3 py-2 rounded-lg border border-white/5 focus:border-purple-500/50 focus:outline-none resize-none font-mono"
          />
        </div>

        {/* Model */}
        <div className="mb-6">
          <label className="block text-sm text-t2 mb-1.5">Model</label>
          <select
            value={localModel}
            onChange={(e) => setLocalModel(e.target.value)}
            className="w-full bg-panel text-sm text-t1 px-3 py-2 rounded-lg border border-white/5 focus:border-purple-500/50 focus:outline-none font-mono"
          >
            <option value="claude-sonnet-4-20250514">claude-sonnet-4-20250514</option>
            <option value="claude-haiku-4-5-20251001">claude-haiku-4-5-20251001</option>
            <option value="claude-opus-4-6">claude-opus-4-6</option>
          </select>
        </div>

        {/* AI Scoring Toggle */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm text-t2">AI Scoring</label>
              <p className="text-[10px] text-t4 mt-0.5">AI가 뉴스 중요도를 자동 평가합니다 (Haiku 모델 사용)</p>
            </div>
            <button
              type="button"
              onClick={() => setEnableAiScoring(!enableAiScoring)}
              className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
                enableAiScoring ? 'bg-purple-500' : 'bg-white/10'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  enableAiScoring ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          className="w-full py-2 rounded-lg bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors text-sm font-medium"
        >
          Save
        </button>
      </div>
    </div>
  )
}
