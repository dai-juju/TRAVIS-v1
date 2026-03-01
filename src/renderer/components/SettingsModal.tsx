import { useState, useEffect } from 'react'
import { useSettingsStore } from '../stores/useSettingsStore'

// isOpen: 모달 열림/닫힘 상태, onClose: 모달을 닫는 함수
interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

// 설정 모달 컴포넌트 — API 키, AI 모델 선택, 컨텍스트 프롬프트, AI 스코어링 등을 설정
// 채팅 패널의 톱니바퀴 아이콘을 클릭하면 열림
export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { apiKey, tavilyApiKey, cmcApiKey, contextPrompt, model, enableAiScoring, enableSound, setApiKey, setTavilyApiKey, setCmcApiKey, setContextPrompt, setModel, setEnableAiScoring, setEnableSound } =
    useSettingsStore()

  // 모달 내부에서 임시로 편집하는 값들 (Save 누르기 전까지는 저장소에 반영하지 않음)
  const [localKey, setLocalKey] = useState(apiKey)
  const [localTavilyKey, setLocalTavilyKey] = useState(tavilyApiKey)
  const [localCmcKey, setLocalCmcKey] = useState(cmcApiKey)
  const [localPrompt, setLocalPrompt] = useState(contextPrompt)
  const [localModel, setLocalModel] = useState(model)

  // 모달 열릴 때 현재 값으로 초기화
  useEffect(() => {
    if (isOpen) {
      setLocalKey(apiKey)
      setLocalTavilyKey(tavilyApiKey)
      setLocalCmcKey(cmcApiKey)
      setLocalPrompt(contextPrompt)
      setLocalModel(model)
    }
  }, [isOpen, apiKey, tavilyApiKey, cmcApiKey, contextPrompt, model])

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

  // Save 버튼 클릭 시 — 모든 설정 값을 저장소에 반영하고 모달 닫기
  const handleSave = () => {
    setApiKey(localKey.trim())
    setTavilyApiKey(localTavilyKey.trim())
    setCmcApiKey(localCmcKey.trim())
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

        {/* CoinMarketCap API Key */}
        <div className="mb-5">
          <label className="block text-sm text-t2 mb-1.5">CoinMarketCap API Key <span className="text-t4">(supplementary data)</span></label>
          <input
            type="password"
            value={localCmcKey}
            onChange={(e) => setLocalCmcKey(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="w-full bg-white/5 text-sm text-t1 placeholder-t4 px-3 py-2 rounded-lg border border-white/5 focus:border-purple-500/50 focus:outline-none font-mono"
          />
          <p className="text-[10px] text-t4 mt-1">https://coinmarketcap.com/api/ 에서 무료 발급</p>
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

        {/* Sound Toggle */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm text-t2">Sound Effects</label>
              <p className="text-[10px] text-t4 mt-0.5">카드 생성, AI 응답 등에 효과음을 재생합니다</p>
            </div>
            <button
              type="button"
              onClick={() => setEnableSound(!enableSound)}
              className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${
                enableSound ? 'bg-purple-500' : 'bg-white/10'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  enableSound ? 'translate-x-5' : 'translate-x-0'
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
