import { useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useCanvasStore } from '../stores/useCanvasStore'
import type { CardData } from '../types'

interface CardProps {
  card: CardData
}

export default function Card({ card }: CardProps) {
  const updateCardPosition = useCanvasStore((s) => s.updateCardPosition)
  const updateCardSize = useCanvasStore((s) => s.updateCardSize)
  const removeCard = useCanvasStore((s) => s.removeCard)

  const isDragging = useRef(false)
  const isResizing = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, cardX: 0, cardY: 0 })
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 })

  // --- Drag ---
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return
      e.stopPropagation()
      isDragging.current = true
      const zoom = useCanvasStore.getState().viewport.zoom
      dragStart.current = {
        x: e.clientX / zoom,
        y: e.clientY / zoom,
        cardX: card.x,
        cardY: card.y,
      }

      const handleMouseMove = (ev: MouseEvent) => {
        if (!isDragging.current) return
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

  // cardType 에 따른 accent 색상
  const accentColor = getAccentColor(card.cardType)

  return (
    <div
      className="h-full flex flex-col rounded-lg overflow-hidden border border-white/10 bg-[#16161e] shadow-xl"
      style={{ minWidth: 240 }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-grab active:cursor-grabbing select-none"
        style={{ borderBottom: `1px solid ${accentColor}33` }}
        onMouseDown={handleDragStart}
      >
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: accentColor }}
        />
        <span className="flex-1 text-xs font-bold text-gray-200 truncate tracking-wide">
          {card.title}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            removeCard(card.id)
          }}
          className="text-gray-600 hover:text-gray-300 transition-colors flex-shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-2 card-markdown text-sm text-gray-300">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{card.content}</ReactMarkdown>

        {/* Images */}
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
                  <figcaption className="text-xs text-gray-500 mt-1">
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
        <svg className="w-4 h-4 text-gray-600" viewBox="0 0 16 16" fill="currentColor">
          <path d="M14 14H10L14 10V14ZM14 8V6L6 14H8L14 8Z" />
        </svg>
      </div>
    </div>
  )
}

function getAccentColor(cardType?: string): string {
  switch (cardType) {
    case 'price':
      return '#22d3ee' // cyan
    case 'analysis':
      return '#a855f7' // purple
    case 'news':
      return '#f97316' // orange
    case 'comparison':
      return '#3b82f6' // blue
    case 'data':
      return '#10b981' // emerald
    case 'summary':
      return '#eab308' // yellow
    default:
      return '#a855f7' // default purple
  }
}
