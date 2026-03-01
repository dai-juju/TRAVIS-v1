import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useInvestigationStore } from '../stores/useInvestigationStore'
import InvestigationPanel from './InvestigationPanel'

// 심층 분석 모드 컴포넌트 — 카드를 더블클릭하면 전체 화면으로 6개 패널(차트, 뉴스, 고래 거래, 온체인, 섹터, AI 요약)을 표시
// ESC 키 또는 닫기 버튼으로 종료, 패널 개별 최대화/접기 가능
export default function InvestigationMode() {
  // targetCard: 분석 대상이 되는 카드 데이터
  const targetCard = useInvestigationStore((s) => s.targetCard)
  // panels: 6개 분석 패널 (차트, 뉴스, 고래, 온체인, 섹터, AI 분석)
  const panels = useInvestigationStore((s) => s.panels)
  const close = useInvestigationStore((s) => s.close)

  // ESC 키를 누르면 심층 분석 모드를 닫고 일반 화면으로 돌아감
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [close])

  if (!targetCard) return null

  const displayTitle = targetCard.symbol
    ? `${targetCard.symbol.toUpperCase()} — ${targetCard.title}`
    : targetCard.title

  // visible이 false인 패널은 제외
  const visiblePanels = panels.filter((p) => p.visible !== false)

  // 최대화된 패널이 있으면 해당 패널만 전체 화면으로 표시
  const hasMaximized = visiblePanels.some((p) => p.isMaximized)

  // 동적 그리드: 패널 수에 따라 열/행 자동 조정
  const panelCount = visiblePanels.length
  const cols = hasMaximized ? 1 : panelCount <= 2 ? panelCount : panelCount <= 4 ? 2 : 3
  const rows = hasMaximized ? 1 : Math.ceil(panelCount / cols)

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: 'rgba(1,1,10,0.9)', backdropFilter: 'blur(8px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Scan line */}
      <div className="absolute top-0 left-0 right-0 h-[1px] scan-line z-10" />

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-t1 font-rajdhani">
            {displayTitle}
          </span>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 tracking-widest">
            INVESTIGATION MODE
          </span>
          {panelCount > 6 && (
            <span className="text-[10px] font-mono text-t4">
              {panelCount} panels
            </span>
          )}
        </div>
        <button
          onClick={close}
          className="text-t3 hover:text-t1 transition-colors p-1"
          title="Close (ESC)"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 패널 그리드 — 동적 열/행, 패널 size에 따라 span 조정 */}
      <div
        className="flex-1 p-4 min-h-0 overflow-y-auto"
        style={{
          display: 'grid',
          gridTemplateColumns: hasMaximized ? '1fr' : `repeat(${cols}, 1fr)`,
          gridAutoRows: hasMaximized ? '1fr' : `minmax(200px, 1fr)`,
          gap: '12px',
        }}
      >
        {visiblePanels.map((panel, i) => {
          // maximized된 패널이 있으면 그것만 표시
          if (hasMaximized && !panel.isMaximized) return null
          return (
            <InvestigationPanel
              key={panel.id}
              panel={panel}
              index={i}
              isMain={i === 0}
            />
          )
        })}
      </div>

      {/* 하단 미세한 그리드 라인 배경 (장식) */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
    </motion.div>
  )
}
