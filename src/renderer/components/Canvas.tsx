import { useRef, useCallback, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useCanvasStore } from '../stores/useCanvasStore'
import SpawnAnimation from './SpawnAnimation'
import Card from './Card'
import type { CardData } from '../types'

export default function Canvas() {
  const viewport = useCanvasStore((s) => s.viewport)
  const setViewport = useCanvasStore((s) => s.setViewport)
  const cards = useCanvasStore((s) => s.cards)
  const containerRef = useRef<HTMLDivElement>(null)
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })

  // --- Pan ---
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // 카드 위에서 시작된 이벤트는 무시 (카드가 stopPropagation 처리)
    if (e.button !== 0) return
    isPanning.current = true
    const { x, y } = useCanvasStore.getState().viewport
    panStart.current = { x: e.clientX - x, y: e.clientY - y }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return
    setViewport({
      x: e.clientX - panStart.current.x,
      y: e.clientY - panStart.current.y,
    })
  }, [setViewport])

  const handleMouseUp = useCallback(() => {
    isPanning.current = false
  }, [])

  // --- Zoom (non-passive listener for preventDefault) ---
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const { zoom, x, y } = useCanvasStore.getState().viewport
      const factor = e.deltaY > 0 ? 0.9 : 1.1
      const newZoom = Math.min(Math.max(zoom * factor, 0.1), 3)

      // 마우스 포인터 기준 줌
      const rect = el.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      const newX = mouseX - (mouseX - x) * (newZoom / zoom)
      const newY = mouseY - (mouseY - y) * (newZoom / zoom)

      useCanvasStore.getState().setViewport({ x: newX, y: newY, zoom: newZoom })
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [])

  // 그리드 패턴 (viewport에 따라 이동/스케일)
  const gridSize = 30 * viewport.zoom
  const gridOffsetX = viewport.x % gridSize
  const gridOffsetY = viewport.y % gridSize

  return (
    <div
      ref={containerRef}
      className="flex-1 h-full relative overflow-hidden select-none cursor-grab active:cursor-grabbing"
      style={{
        backgroundColor: '#0a0a0f',
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
        backgroundSize: `${gridSize}px ${gridSize}px`,
        backgroundPosition: `${gridOffsetX}px ${gridOffsetY}px`,
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* 카드 컨테이너 — viewport 변환 적용 */}
      <div
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
        }}
      >
        <AnimatePresence mode="popLayout">
          {cards.map((item) => {
            if (item.type === 'card') {
              const cardData = item as CardData
              return (
                <SpawnAnimation
                  key={item.id}
                  x={item.x}
                  y={item.y}
                  width={item.width}
                  height={item.height}
                  delay={cardData.spawnDelay || 0}
                >
                  <Card card={cardData} />
                </SpawnAnimation>
              )
            }
            // Phase 1-6에서 WebviewCard 렌더링
            return null
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
