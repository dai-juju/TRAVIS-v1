import { useRef, useCallback, useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useCanvasStore } from '../stores/useCanvasStore'
import { useChatStore } from '../stores/useChatStore'
import SpawnAnimation from './SpawnAnimation'
import Card from './Card'
import WebviewCard from './WebviewCard'
import EdgeLayer from './EdgeLayer'
import type { CardData, WebviewData } from '../types'

// 무한 캔버스 컴포넌트 — AI가 생성한 카드와 웹뷰가 배치되는 드래그 가능한 작업 공간
// 마우스로 캔버스를 드래그하여 이동하고, 스크롤로 확대/축소 가능
export default function Canvas() {
  // viewport: 캔버스의 현재 위치(x, y)와 확대 수준(zoom)
  const viewport = useCanvasStore((s) => s.viewport)
  const setViewport = useCanvasStore((s) => s.setViewport)
  // cards: 캔버스에 표시된 모든 카드/웹뷰 목록
  const cards = useCanvasStore((s) => s.cards)
  const clearPins = useCanvasStore((s) => s.clearPins)
  const containerRef = useRef<HTMLDivElement>(null)
  // 캔버스 이동(패닝) 관련 상태 추적용 변수들
  const isPanning = useRef(false)
  const didPan = useRef(false)
  const panStart = useRef({ x: 0, y: 0 })

  // --- 캔버스 이동(패닝) --- 마우스 왼쪽 버튼을 누른 채 드래그하면 캔버스가 이동
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // 카드 위에서 시작된 이벤트는 무시 (카드가 stopPropagation 처리)
    if (e.button !== 0) return
    isPanning.current = true
    didPan.current = false
    const { x, y } = useCanvasStore.getState().viewport
    panStart.current = { x: e.clientX - x, y: e.clientY - y }
  }, [])

  // 마우스 이동 시 캔버스 위치 업데이트
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return
    didPan.current = true
    setViewport({
      x: e.clientX - panStart.current.x,
      y: e.clientY - panStart.current.y,
    })
  }, [setViewport])

  const handleMouseUp = useCallback(() => {
    // 빈 캔버스 클릭 (패닝 없이 마우스 떼기) → 핀 해제 + focusedCard 해제
    if (isPanning.current && !didPan.current) {
      clearPins()
      useChatStore.getState().clearFocusedCard()
    }
    isPanning.current = false
    didPan.current = false
  }, [clearPins])

  // --- 확대/축소(줌) --- 마우스 휠로 캔버스를 확대하거나 축소 (최소 0.1배 ~ 최대 3배)
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
        backgroundColor: '#01010a',
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)',
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
        {/* Edge layer — 카드 아래에 렌더링 */}
        <EdgeLayer />

        {/* 카드 목록 렌더링 — 각 카드를 생성 애니메이션과 함께 표시 */}
        <AnimatePresence mode="popLayout">
          {cards.map((item) => {
            // 일반 정보 카드 (텍스트/마크다운 형태)
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
            // 웹뷰 카드 (외부 웹사이트를 캔버스에 직접 임베드)
            if (item.type === 'webview') {
              const webviewData = item as WebviewData
              return (
                <SpawnAnimation
                  key={item.id}
                  x={item.x}
                  y={item.y}
                  width={item.width}
                  height={item.height}
                >
                  <WebviewCard card={webviewData} />
                </SpawnAnimation>
              )
            }
            return null
          })}
        </AnimatePresence>
      </div>
    </div>
  )
}
