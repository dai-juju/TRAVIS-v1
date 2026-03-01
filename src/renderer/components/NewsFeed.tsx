import { useRef, useEffect, useCallback } from 'react'
import { useFeedStore } from '../stores/useFeedStore'
import FeedItem from './FeedItem'

// 왼쪽 실시간 뉴스 피드 패널 — 외부 소스에서 수집된 최신 뉴스를 시간순으로 표시
// 새 뉴스가 도착하면 자동으로 맨 위로 스크롤 (마우스를 올려놓지 않은 경우에만)
export default function NewsFeed() {
  const getFilteredItems = useFeedStore((s) => s.getFilteredItems)
  const items = useFeedStore((s) => s.getFilteredItems())
  const scrollRef = useRef<HTMLDivElement>(null)
  const isHovered = useRef(false)
  const prevCountRef = useRef(0)

  // 새 뉴스 아이템이 추가되면 자동으로 맨 위로 스크롤 (사용자가 읽고 있을 때는 방해하지 않음)
  useEffect(() => {
    if (items.length > prevCountRef.current && !isHovered.current && scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
    prevCountRef.current = items.length
  }, [items.length])

  // 마우스가 뉴스 목록 위에 있는지 추적 — 읽는 중일 때 자동 스크롤 방지
  const handleMouseEnter = useCallback(() => { isHovered.current = true }, [])
  const handleMouseLeave = useCallback(() => { isHovered.current = false }, [])

  // 뉴스가 1건이라도 있으면 연결된 것으로 표시
  const isConnected = items.length > 0

  return (
    <div className="w-[220px] flex-shrink-0 bg-deep border-r border-white/5 flex flex-col">
      {/* Header */}
      <div className="h-9 flex items-center justify-between px-3 border-b border-white/5">
        <span className="text-[11px] font-rajdhani font-bold text-t3 tracking-widest">
          ◈ LIVE FEED
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono text-t4">
            {items.length}
          </span>
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
            }`}
          />
        </div>
      </div>

      {/* Feed list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto feed-scrollbar"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {items.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-xs font-mono text-t4">Connecting...</span>
          </div>
        ) : (
          items.map((item) => (
            <FeedItem key={item.id} item={item} />
          ))
        )}
      </div>
    </div>
  )
}
