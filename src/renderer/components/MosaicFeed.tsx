import { useState, useRef, useCallback, useEffect } from 'react'
import FeedSidebar from './FeedSidebar'
import MultiColumnFeed from './MultiColumnFeed'
import WorldMap from './WorldMap'
import EventCalendar from './EventCalendar'

// FEED 탭의 메인 컴포넌트 — 세계지도/캘린더, 피드 사이드바, 7열 카테고리 피드를 조합한 화면
// 상단: 세계지도 또는 이벤트 캘린더 + 오른쪽 전체 피드
// 하단: 카테고리별 7열 피드 (드래그 핸들로 높이 조절 가능)
export default function MosaicFeed() {
  const containerRef = useRef<HTMLDivElement>(null)
  // bottomHeight: 하단 7열 피드 영역의 높이 (0이면 접혀있음)
  const [bottomHeight, setBottomHeight] = useState(0)
  // leftView: 좌측 영역에 세계지도를 표시할지 캘린더를 표시할지 선택
  const [leftView, setLeftView] = useState<'map' | 'calendar'>('map')
  const [isDraggingState, setIsDraggingState] = useState(false)
  const isDragging = useRef(false)
  const dragStartY = useRef(0)
  const dragStartHeight = useRef(0)
  const dragMoved = useRef(false)

  // 구분선 드래그 시작 — 상단/하단 영역 비율을 조절하기 위해 마우스 위치 추적 시작
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    dragMoved.current = false
    dragStartY.current = e.clientY
    dragStartHeight.current = bottomHeight
    setIsDraggingState(true)
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [bottomHeight])

  // 구분선 드래그 중 높이 조절 및 드래그 종료 처리
  // 클릭만 하면(드래그 없이) 하단 영역을 열기/닫기 토글
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return
      const delta = dragStartY.current - e.clientY
      if (Math.abs(delta) > 3) dragMoved.current = true
      const containerH = containerRef.current.getBoundingClientRect().height
      const maxH = containerH - 200
      const newH = Math.max(0, Math.min(maxH, dragStartHeight.current + delta))
      setBottomHeight(newH)
    }

    const handleMouseUp = () => {
      if (!isDragging.current) return
      isDragging.current = false
      setIsDraggingState(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''

      // 클릭 토글 (드래그 없이 클릭만 했을 때)
      if (!dragMoved.current) {
        setBottomHeight((prev) => (prev > 0 ? 0 : 300))
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  return (
    <div ref={containerRef} className="h-full flex flex-col bg-void">
      {/* Top section: WorldMap placeholder + FeedSidebar */}
      <div className="flex-1 min-h-0 flex">
        {/* WorldMap / EventCalendar */}
        <div className="flex-1 flex flex-col border-r border-white/5 bg-deep">
          {/* Mini tabs */}
          <div className="h-8 flex items-center gap-0 px-2 border-b border-white/5 flex-shrink-0">
            <button
              onClick={() => setLeftView('map')}
              className={`text-[10px] font-rajdhani font-bold tracking-wider px-3 py-1 rounded-l transition-colors ${
                leftView === 'map' ? 'bg-white/10 text-t1' : 'text-t4 hover:text-t3'
              }`}
            >
              MAP
            </button>
            <button
              onClick={() => setLeftView('calendar')}
              className={`text-[10px] font-rajdhani font-bold tracking-wider px-3 py-1 rounded-r transition-colors ${
                leftView === 'calendar' ? 'bg-white/10 text-t1' : 'text-t4 hover:text-t3'
              }`}
            >
              CALENDAR
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0">
            {leftView === 'map' ? <WorldMap /> : <EventCalendar />}
          </div>
        </div>

        {/* FeedSidebar */}
        <FeedSidebar />
      </div>

      {/* Drag handle */}
      <div
        className="h-7 bg-deep border-y border-white/5 cursor-row-resize flex items-center justify-center gap-2 hover:bg-white/[0.03] transition-colors group flex-shrink-0"
        onMouseDown={handleDragStart}
      >
        <span className="text-[9px] font-mono text-t4 group-hover:text-t3 transition-colors select-none">
          {bottomHeight > 0 ? '\u25BC' : '\u25B2'} DETAILED FEED
        </span>
      </div>

      {/* Bottom section: MultiColumnFeed */}
      <div
        style={{ height: bottomHeight }}
        className={`flex-shrink-0 overflow-hidden ${
          !isDraggingState ? 'transition-[height] duration-300 ease-out' : ''
        }`}
      >
        <MultiColumnFeed />
      </div>
    </div>
  )
}
