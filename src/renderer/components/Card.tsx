import { useRef, useCallback, useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useCanvasStore } from '../stores/useCanvasStore'
import { useRealtimeStore } from '../stores/useRealtimeStore'
import { useInvestigationStore } from '../stores/useInvestigationStore'
import LatencyIndicator from './LatencyIndicator'
import type { CardData } from '../types'

interface CardProps {
  card: CardData
}

export default function Card({ card }: CardProps) {
  const updateCardPosition = useCanvasStore((s) => s.updateCardPosition)
  const updateCardSize = useCanvasStore((s) => s.updateCardSize)
  const removeCard = useCanvasStore((s) => s.removeCard)
  const setHoveredNode = useCanvasStore((s) => s.setHoveredNode)
  const togglePinNode = useCanvasStore((s) => s.togglePinNode)
  const openInvestigation = useInvestigationStore((s) => s.open)

  const subscribe = useRealtimeStore((s) => s.subscribe)
  const unsubscribe = useRealtimeStore((s) => s.unsubscribe)
  const ticker = useRealtimeStore((s) => card.symbol ? s.tickers[card.symbol.toUpperCase()] : undefined)

  const [flash, setFlash] = useState<'up' | 'down' | null>(null)

  const isDragging = useRef(false)
  const didDrag = useRef(false)
  const isResizing = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, cardX: 0, cardY: 0 })
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 })

  // 실시간 데이터 구독
  useEffect(() => {
    if (!card.symbol) return
    const sym = card.symbol.toUpperCase()
    subscribe(sym)
    return () => unsubscribe(sym)
  }, [card.symbol, subscribe, unsubscribe])

  // 가격 변동 플래시
  useEffect(() => {
    if (!ticker || ticker.prevPrice === ticker.price) return
    setFlash(ticker.price > ticker.prevPrice ? 'up' : 'down')
    const timer = setTimeout(() => setFlash(null), 500)
    return () => clearTimeout(timer)
  }, [ticker?.price, ticker?.prevPrice])

  // --- Drag ---
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return
      e.stopPropagation()
      isDragging.current = true
      didDrag.current = false
      const zoom = useCanvasStore.getState().viewport.zoom
      dragStart.current = {
        x: e.clientX / zoom,
        y: e.clientY / zoom,
        cardX: card.x,
        cardY: card.y,
      }

      const handleMouseMove = (ev: MouseEvent) => {
        if (!isDragging.current) return
        didDrag.current = true
        const z = useCanvasStore.getState().viewport.zoom
        const dx = ev.clientX / z - dragStart.current.x
        const dy = ev.clientY / z - dragStart.current.y
        updateCardPosition(
          card.id,
          dragStart.current.cardX + dx,
          dragStart.current.cardY + dy
        )
      }

      const handleMouseUp = () => {
        isDragging.current = false
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }

      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    },
    [card.id, card.x, card.y, updateCardPosition]
  )

  // --- Resize ---
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      isResizing.current = true
      resizeStart.current = {
        x: e.clientX,
        y: e.clientY,
        w: card.width,
        h: card.height,
      }

      const handleMouseMove = (ev: MouseEvent) => {
        if (!isResizing.current) return
        const zoom = useCanvasStore.getState().viewport.zoom
        const dw = (ev.clientX - resizeStart.current.x) / zoom
        const dh = (ev.clientY - resizeStart.current.y) / zoom
        updateCardSize(
          card.id,
          Math.max(240, resizeStart.current.w + dw),
          Math.max(120, resizeStart.current.h + dh)
        )
      }

      const handleMouseUp = () => {
        isResizing.current = false
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }

      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    },
    [card.id, card.width, card.height, updateCardSize]
  )

  const handleHeaderClick = useCallback(() => {
    // 드래그 후에는 pin 토글하지 않음
    if (didDrag.current) return
    togglePinNode(card.id)
  }, [card.id, togglePinNode])

  const accentColor = getAccentColor(card.cardType)

  return (
    <div
      className="h-full flex flex-col rounded-lg overflow-hidden border border-white/5 bg-card shadow-xl"
      style={{ minWidth: 240 }}
      onMouseEnter={() => setHoveredNode(card.id)}
      onMouseLeave={() => setHoveredNode(null)}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-grab active:cursor-grabbing select-none"
        style={{ borderBottom: `1px solid ${accentColor}33` }}
        onMouseDown={handleDragStart}
        onClick={handleHeaderClick}
        onDoubleClick={(e) => { e.stopPropagation(); openInvestigation(card) }}
      >
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: accentColor }}
        />
        <span className="flex-1 text-xs font-bold text-t1 truncate tracking-wide font-rajdhani">
          {card.title}
        </span>
        {card.symbol && (
          <LatencyIndicator latency={ticker ? ticker.latency : null} />
        )}
        <button
          onClick={(e) => {
            e.stopPropagation()
            removeCard(card.id)
          }}
          className="text-t4 hover:text-t2 transition-colors flex-shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Real-time price bar */}
      {card.symbol && ticker && (
        <div
          className="px-3 py-1.5 border-b border-white/5 flex items-center gap-2 transition-colors duration-500"
          style={{
            backgroundColor: flash === 'up'
              ? 'rgba(34,197,94,0.15)'
              : flash === 'down'
                ? 'rgba(239,68,68,0.15)'
                : 'transparent',
          }}
        >
          <span className="text-base font-bold text-t1 font-mono">
            ${ticker.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
          </span>
          <span
            className="text-xs font-mono font-semibold px-1.5 py-0.5 rounded"
            style={{
              color: ticker.change24h >= 0 ? '#22c55e' : '#ef4444',
              backgroundColor: ticker.change24h >= 0 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            }}
          >
            {ticker.change24h >= 0 ? '+' : ''}{ticker.change24h.toFixed(2)}%
          </span>
          <span className="text-[10px] text-t3 font-mono ml-auto">
            Vol {formatVolume(ticker.volume24h)}
          </span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-2 card-markdown text-sm text-t2">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{card.content}</ReactMarkdown>

        {card.images && card.images.length > 0 && (
          <div className="mt-2 space-y-2">
            {card.images.map((img, i) => (
              <figure key={i}>
                <img
                  src={img.url}
                  alt={img.caption || ''}
                  className="w-full rounded border border-white/5"
                  loading="lazy"
                />
                {img.caption && (
                  <figcaption className="text-xs text-t3 mt-1">
                    {img.caption}
                  </figcaption>
                )}
              </figure>
            ))}
          </div>
        )}
      </div>

      {/* Resize handle */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize opacity-0 hover:opacity-100 transition-opacity"
        onMouseDown={handleResizeStart}
      >
        <svg className="w-4 h-4 text-t4" viewBox="0 0 16 16" fill="currentColor">
          <path d="M14 14H10L14 10V14ZM14 8V6L6 14H8L14 8Z" />
        </svg>
      </div>
    </div>
  )
}

function getAccentColor(cardType?: string): string {
  switch (cardType) {
    case 'price':
      return '#22d3ee'
    case 'analysis':
      return '#a855f7'
    case 'news':
      return '#f97316'
    case 'comparison':
      return '#3b82f6'
    case 'data':
      return '#10b981'
    case 'summary':
      return '#eab308'
    default:
      return '#a855f7'
  }
}

function formatVolume(vol: number): string {
  if (vol >= 1e9) return (vol / 1e9).toFixed(1) + 'B'
  if (vol >= 1e6) return (vol / 1e6).toFixed(1) + 'M'
  if (vol >= 1e3) return (vol / 1e3).toFixed(1) + 'K'
  return vol.toFixed(0)
}
