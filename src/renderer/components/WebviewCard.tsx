import { useRef, useCallback, useState, useEffect } from 'react'
import { useCanvasStore } from '../stores/useCanvasStore'
import type { WebviewData } from '../types'

interface WebviewCardProps {
  card: WebviewData
}

export default function WebviewCard({ card }: WebviewCardProps) {
  const updateCardPosition = useCanvasStore((s) => s.updateCardPosition)
  const updateCardSize = useCanvasStore((s) => s.updateCardSize)
  const removeCard = useCanvasStore((s) => s.removeCard)

  const [isLoading, setIsLoading] = useState(true)
  const [hasFailed, setHasFailed] = useState(false)
  const webviewRef = useRef<HTMLElement>(null)

  const isDragging = useRef(false)
  const isResizing = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, cardX: 0, cardY: 0 })
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 })

  // Webview 이벤트 바인딩
  useEffect(() => {
    const wv = webviewRef.current
    if (!wv) return

    const onLoadStart = () => { setIsLoading(true); setHasFailed(false) }
    const onLoadStop = () => setIsLoading(false)
    const onFail = () => { setIsLoading(false); setHasFailed(true) }

    wv.addEventListener('did-start-loading', onLoadStart)
    wv.addEventListener('did-stop-loading', onLoadStop)
    wv.addEventListener('did-fail-load', onFail)

    return () => {
      wv.removeEventListener('did-start-loading', onLoadStart)
      wv.removeEventListener('did-stop-loading', onLoadStop)
      wv.removeEventListener('did-fail-load', onFail)
    }
  }, [])

  const handleReload = useCallback(() => {
    const wv = webviewRef.current as HTMLElement & { reload?: () => void }
    if (wv?.reload) {
      setHasFailed(false)
      wv.reload()
    }
  }, [])

  const handleOpenExternal = useCallback(() => {
    window.open(card.url, '_blank')
  }, [card.url])

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
          Math.max(400, resizeStart.current.w + dw),
          Math.max(300, resizeStart.current.h + dh)
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

  // URL 표시용 — 긴 URL 축약
  const displayUrl = card.url.length > 45
    ? card.url.slice(0, 42) + '...'
    : card.url

  return (
    <div
      className="h-full flex flex-col rounded-lg overflow-hidden border border-white/5 bg-card shadow-xl"
      style={{ minWidth: 320 }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-grab active:cursor-grabbing select-none border-b border-accent-cyan/20"
        onMouseDown={handleDragStart}
      >
        <div className="w-2 h-2 rounded-full flex-shrink-0 bg-accent-cyan" />
        <span className="flex-1 text-xs font-bold text-t1 truncate tracking-wide font-rajdhani">
          {card.title}
        </span>

        {/* Reload */}
        <button
          onClick={(e) => { e.stopPropagation(); handleReload() }}
          className="text-t3 hover:text-t2 transition-colors flex-shrink-0"
          title="Reload"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
          </svg>
        </button>

        {/* Close */}
        <button
          onClick={(e) => { e.stopPropagation(); removeCard(card.id) }}
          className="text-t4 hover:text-t2 transition-colors flex-shrink-0"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* URL bar */}
      <div className="px-3 py-1 bg-black/30 border-b border-white/5">
        <span className="text-[10px] text-t3 font-mono select-text">{displayUrl}</span>
      </div>

      {/* Webview body */}
      <div className="flex-1 relative overflow-hidden min-h-0">
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-card z-10">
            <div className="flex flex-col items-center gap-2">
              <div className="w-5 h-5 border-2 border-accent-cyan/30 border-t-accent-cyan rounded-full animate-spin" />
              <span className="text-xs text-t3">Loading...</span>
            </div>
          </div>
        )}

        {/* Error fallback */}
        {hasFailed && !isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-card z-10">
            <div className="flex flex-col items-center gap-3 text-center px-4">
              <span className="text-sm text-t2">Failed to load this page</span>
              <span className="text-xs text-t4">This site may block embedding</span>
              <button
                onClick={handleOpenExternal}
                className="px-3 py-1.5 text-xs bg-accent-cyan/20 text-accent-cyan rounded hover:bg-accent-cyan/30 transition-colors"
              >
                Open in Browser
              </button>
            </div>
          </div>
        )}

        <webview
          ref={webviewRef as React.RefObject<HTMLElement>}
          src={card.url}
          allowpopups=""
          style={{ display: 'flex', width: '100%', height: '100%' }}
        />
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
