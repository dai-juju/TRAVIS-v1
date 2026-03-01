import { useRef, useCallback, useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useCanvasStore } from '../stores/useCanvasStore'
import { useRealtimeStore } from '../stores/useRealtimeStore'
import { useInvestigationStore } from '../stores/useInvestigationStore'
import { useChatStore } from '../stores/useChatStore'
import LatencyIndicator from './LatencyIndicator'
import type { CardData } from '../types'

// card: 카드 데이터 (제목, 내용, 심볼, 위치 등 포함)
interface CardProps {
  card: CardData
}

// 단일 정보 카드 컴포넌트 — AI가 생성한 정보를 표시하는 카드
// 실시간 가격 표시, 드래그 이동, 크기 조절, 더블클릭으로 심층 분석 모드 진입 가능
export default function Card({ card }: CardProps) {
  const updateCardPosition = useCanvasStore((s) => s.updateCardPosition)
  const updateCardSize = useCanvasStore((s) => s.updateCardSize)
  const removeCard = useCanvasStore((s) => s.removeCard)
  const setHoveredNode = useCanvasStore((s) => s.setHoveredNode)
  const togglePinNode = useCanvasStore((s) => s.togglePinNode)
  const openInvestigation = useInvestigationStore((s) => s.open)

  // 실시간 가격 데이터 구독/해제 함수
  const subscribe = useRealtimeStore((s) => s.subscribe)
  const unsubscribe = useRealtimeStore((s) => s.unsubscribe)
  // ticker: 이 카드에 연결된 코인의 실시간 가격/변동률/거래량 데이터
  const ticker = useRealtimeStore((s) => card.symbol ? s.tickers[card.symbol.toUpperCase()] : undefined)

  // flash: 가격 변동 시 짧게 초록/빨강으로 반짝이는 효과
  const [flash, setFlash] = useState<'up' | 'down' | null>(null)

  const isDragging = useRef(false)
  const didDrag = useRef(false)
  const isResizing = useRef(false)
  const dragStart = useRef({ x: 0, y: 0, cardX: 0, cardY: 0 })
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 })

  // 카드에 코인 심볼이 있으면 실시간 가격 데이터를 바이낸스에서 구독
  useEffect(() => {
    if (!card.symbol) return
    const sym = card.symbol.toUpperCase()
    subscribe(sym)
    // 카드가 사라질 때 구독 해제하여 불필요한 데이터 수신 방지
    return () => unsubscribe(sym)
  }, [card.symbol, subscribe, unsubscribe])

  // 가격이 변할 때마다 0.5초간 초록(상승) 또는 빨강(하락) 깜빡임 효과 표시
  useEffect(() => {
    if (!ticker || ticker.prevPrice === ticker.price) return
    setFlash(ticker.price > ticker.prevPrice ? 'up' : 'down')
    const timer = setTimeout(() => setFlash(null), 500)
    return () => clearTimeout(timer)
  }, [ticker?.price, ticker?.prevPrice])

  // --- 카드 드래그 이동 --- 카드 헤더를 마우스로 잡아 이동 가능
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

  // --- 카드 크기 조절 --- 카드 우하단 모서리를 드래그하여 크기 변경
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

  // 카드 헤더 클릭 — 연결선(엣지)을 고정 표시할지 토글 (드래그 후에는 무시)
  const handleHeaderClick = useCallback(() => {
    if (didDrag.current) return
    togglePinNode(card.id)
  }, [card.id, togglePinNode])

  // 현재 채팅에서 참조 중인 카드인지 확인 (참조 중이면 보라색 테두리 표시)
  const focusedCardId = useChatStore((s) => s.focusedCard?.id)
  const isFocused = focusedCardId === card.id
  // 카드 종류(가격/분석/뉴스 등)에 따른 강조 색상 결정
  const accentColor = getAccentColor(card.cardType)

  return (
    <div
      className={`h-full flex flex-col rounded-lg overflow-hidden border bg-card shadow-xl ${isFocused ? 'border-purple-500/50' : 'border-white/5'}`}
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

      {/* 카드 내용 — isLoading이면 스켈레톤, 아니면 실제 콘텐츠 */}
      {card.isLoading ? (
        <div className="flex-1 px-3 py-3 space-y-2">
          {[80, 60, 90, 40].map((w, i) => (
            <div
              key={i}
              className="h-3 rounded animate-pulse"
              style={{
                width: `${w}%`,
                backgroundColor: 'rgba(255,255,255,0.07)',
                animationDelay: `${i * 0.15}s`,
                animationDuration: '1.5s',
              }}
            />
          ))}
        </div>
      ) : (
        <div
          className="flex-1 overflow-y-auto px-3 py-2 card-markdown text-sm text-t2 cursor-pointer"
          onClick={() => useChatStore.getState().setFocusedCard({
            id: card.id, title: card.title, content: card.content
          })}
        >
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
      )}

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

// 카드 종류별 강조 색상 반환 — 가격은 시안, 분석은 보라, 뉴스는 주황 등
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

// 거래량 숫자를 읽기 쉬운 형태로 변환 (예: 1,500,000 → 1.5M)
function formatVolume(vol: number): string {
  if (vol >= 1e9) return (vol / 1e9).toFixed(1) + 'B'
  if (vol >= 1e6) return (vol / 1e6).toFixed(1) + 'M'
  if (vol >= 1e3) return (vol / 1e3).toFixed(1) + 'K'
  return vol.toFixed(0)
}
