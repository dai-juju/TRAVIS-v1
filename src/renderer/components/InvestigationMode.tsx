import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useInvestigationStore } from '../stores/useInvestigationStore'
import InvestigationPanel from './InvestigationPanel'

export default function InvestigationMode() {
  const targetCard = useInvestigationStore((s) => s.targetCard)
  const panels = useInvestigationStore((s) => s.panels)
  const close = useInvestigationStore((s) => s.close)

  // ESC 키로 닫기
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

  const hasMaximized = panels.some((p) => p.isMaximized)

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
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
          <span className="text-lg font-bold text-gray-100">
            {displayTitle}
          </span>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 tracking-widest">
            INVESTIGATION MODE
          </span>
        </div>
        <button
          onClick={close}
          className="text-gray-500 hover:text-gray-200 transition-colors p-1"
          title="Close (ESC)"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Panel grid */}
      <div
        className="flex-1 p-4 min-h-0"
        style={{
          display: 'grid',
          gridTemplateColumns: hasMaximized ? '1fr' : 'repeat(3, 1fr)',
          gridTemplateRows: hasMaximized ? '1fr' : 'repeat(2, 1fr)',
          gap: '12px',
        }}
      >
        {panels.map((panel, i) => {
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
