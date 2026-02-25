import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useInvestigationStore, type PanelState } from '../stores/useInvestigationStore'
import InvestigationChart from './InvestigationChart'
import InvestigationNews from './InvestigationNews'
import InvestigationWhale from './InvestigationWhale'
import InvestigationOnchain from './InvestigationOnchain'
import InvestigationSector from './InvestigationSector'

interface InvestigationPanelProps {
  panel: PanelState
  index: number
  isMain: boolean
}

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  STREAM: { bg: 'rgba(34,211,238,0.15)', text: '#22d3ee' },
  CLAUDE: { bg: 'rgba(168,85,247,0.15)', text: '#a855f7' },
  LOCAL: { bg: 'rgba(107,114,128,0.15)', text: '#94a3b8' },
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center h-full gap-2">
      <div className="w-4 h-4 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      <span className="text-xs font-mono text-t4">Loading...</span>
    </div>
  )
}

function ErrorMessage({ msg }: { msg: string }) {
  return (
    <div className="flex items-center justify-center h-full px-4">
      <div className="text-center">
        <div className="text-red-400 text-xs font-mono mb-1">Error</div>
        <div className="text-t4 text-[10px] font-mono">{msg}</div>
      </div>
    </div>
  )
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function PanelContent({ panel, symbol }: { panel: PanelState; symbol: string }) {
  switch (panel.panelType) {
    case 'chart':
      return <InvestigationChart data={panel.data as any} symbol={symbol} />
    case 'news':
      return <InvestigationNews symbol={symbol} />
    case 'whale':
      return <InvestigationWhale data={panel.data as any} symbol={symbol} />
    case 'onchain':
      return <InvestigationOnchain data={panel.data as any} />
    case 'sector':
      return <InvestigationSector data={panel.data as any} symbol={symbol} />
    case 'markdown':
    default:
      return (
        <div className="overflow-y-auto h-full px-3 py-2 card-markdown text-sm text-t2">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{panel.content}</ReactMarkdown>
        </div>
      )
  }
}

export default function InvestigationPanel({ panel, index, isMain }: InvestigationPanelProps) {
  const toggleMaximize = useInvestigationStore((s) => s.toggleMaximize)
  const toggleFold = useInvestigationStore((s) => s.toggleFold)
  const targetSymbol = useInvestigationStore((s) => s.targetCard?.symbol?.toUpperCase() ?? '')

  const tagStyle = TAG_COLORS[panel.tag] || TAG_COLORS.LOCAL

  return (
    <motion.div
      className="flex flex-col rounded-lg border overflow-hidden"
      style={{
        backgroundColor: '#0a0a18',
        borderColor: isMain ? 'rgba(168,85,247,0.4)' : 'rgba(255,255,255,0.05)',
        boxShadow: isMain ? '0 0 20px rgba(168,85,247,0.15)' : 'none',
        gridColumn: panel.isMaximized ? '1 / -1' : undefined,
        gridRow: panel.isMaximized ? '1 / -1' : undefined,
      }}
      initial={{ opacity: 0, scale: 0.9, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        delay: index * 0.1,
        duration: 0.35,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5 select-none flex-shrink-0">
        <span className="text-xs font-bold text-t1 flex-1 truncate font-rajdhani">
          {panel.title}
        </span>

        {/* Tag badge */}
        <span
          className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
          style={{ backgroundColor: tagStyle.bg, color: tagStyle.text }}
        >
          {panel.tag}
        </span>

        {/* Fold */}
        <button
          onClick={() => toggleFold(panel.id)}
          className="text-t4 hover:text-t2 transition-colors"
          title={panel.isFolded ? 'Expand' : 'Fold'}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
          </svg>
        </button>

        {/* Maximize */}
        <button
          onClick={() => toggleMaximize(panel.id)}
          className="text-t4 hover:text-t2 transition-colors"
          title={panel.isMaximized ? 'Restore' : 'Maximize'}
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {panel.isMaximized ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
            )}
          </svg>
        </button>
      </div>

      {/* Body */}
      {!panel.isFolded && (
        <div className="flex-1 min-h-0 overflow-hidden">
          {panel.isLoading ? (
            <LoadingSpinner />
          ) : panel.error ? (
            <ErrorMessage msg={panel.error} />
          ) : (
            <PanelContent panel={panel} symbol={targetSymbol} />
          )}
        </div>
      )}
    </motion.div>
  )
}
