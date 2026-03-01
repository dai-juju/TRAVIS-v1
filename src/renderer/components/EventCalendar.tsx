import { useState, useMemo } from 'react'
import type { FeedCategory, FeedImportance } from '../types'

// 캘린더 이벤트 데이터 구조 — 날짜, 제목, 카테고리, 중요도
interface CalendarEvent {
  date: string // 'YYYY-MM-DD'
  title: string
  category: FeedCategory
  importance: FeedImportance
}

const CATEGORY_COLOR: Record<FeedCategory, string> = {
  macro: '#f59e0b',
  crypto: '#a855f7',
  onchain: '#22d3ee',
  exchange: '#ef4444',
  social: '#22c55e',
  stocks: '#3b82f6',
  world: '#ec4899',
}

const IMPORTANCE_COLOR: Record<FeedImportance, string> = {
  critical: '#ef4444',
  alert: '#f59e0b',
  signal: '#a855f7',
  info: '#6b7280',
}

// 주요 경제 이벤트 목록 — FOMC 회의, CPI 발표, 고용지표 등 트레이더가 반드시 알아야 할 일정
const HARDCODED_EVENTS: CalendarEvent[] = [
  // 2025 FOMC
  { date: '2025-06-18', title: 'FOMC Meeting', category: 'macro', importance: 'critical' },
  { date: '2025-07-30', title: 'FOMC Meeting', category: 'macro', importance: 'critical' },
  { date: '2025-09-17', title: 'FOMC Meeting', category: 'macro', importance: 'critical' },
  { date: '2025-10-29', title: 'FOMC Meeting', category: 'macro', importance: 'critical' },
  { date: '2025-12-10', title: 'FOMC Meeting', category: 'macro', importance: 'critical' },
  // 2026 FOMC
  { date: '2026-01-28', title: 'FOMC Meeting', category: 'macro', importance: 'critical' },
  { date: '2026-03-18', title: 'FOMC Meeting', category: 'macro', importance: 'critical' },
  { date: '2026-05-06', title: 'FOMC Meeting', category: 'macro', importance: 'critical' },
  { date: '2026-06-17', title: 'FOMC Meeting', category: 'macro', importance: 'critical' },
  { date: '2026-07-29', title: 'FOMC Meeting', category: 'macro', importance: 'critical' },
  { date: '2026-09-16', title: 'FOMC Meeting', category: 'macro', importance: 'critical' },
  { date: '2026-11-04', title: 'FOMC Meeting', category: 'macro', importance: 'critical' },
  { date: '2026-12-16', title: 'FOMC Meeting', category: 'macro', importance: 'critical' },
  // 2025 CPI
  { date: '2025-06-11', title: 'CPI Report', category: 'macro', importance: 'alert' },
  { date: '2025-07-11', title: 'CPI Report', category: 'macro', importance: 'alert' },
  { date: '2025-08-12', title: 'CPI Report', category: 'macro', importance: 'alert' },
  { date: '2025-09-10', title: 'CPI Report', category: 'macro', importance: 'alert' },
  { date: '2025-10-14', title: 'CPI Report', category: 'macro', importance: 'alert' },
  { date: '2025-11-12', title: 'CPI Report', category: 'macro', importance: 'alert' },
  { date: '2025-12-10', title: 'CPI Report', category: 'macro', importance: 'alert' },
  // 2026 CPI
  { date: '2026-01-13', title: 'CPI Report', category: 'macro', importance: 'alert' },
  { date: '2026-02-11', title: 'CPI Report', category: 'macro', importance: 'alert' },
  { date: '2026-03-11', title: 'CPI Report', category: 'macro', importance: 'alert' },
  // 2025 NFP
  { date: '2025-07-03', title: 'Non-Farm Payrolls', category: 'macro', importance: 'alert' },
  { date: '2025-08-01', title: 'Non-Farm Payrolls', category: 'macro', importance: 'alert' },
  { date: '2025-09-05', title: 'Non-Farm Payrolls', category: 'macro', importance: 'alert' },
  { date: '2025-10-03', title: 'Non-Farm Payrolls', category: 'macro', importance: 'alert' },
  { date: '2025-11-07', title: 'Non-Farm Payrolls', category: 'macro', importance: 'alert' },
  { date: '2025-12-05', title: 'Non-Farm Payrolls', category: 'macro', importance: 'alert' },
  // 2026 NFP
  { date: '2026-01-09', title: 'Non-Farm Payrolls', category: 'macro', importance: 'alert' },
  { date: '2026-02-06', title: 'Non-Farm Payrolls', category: 'macro', importance: 'alert' },
  { date: '2026-03-06', title: 'Non-Farm Payrolls', category: 'macro', importance: 'alert' },
  // Crypto
  { date: '2025-04-17', title: 'BTC Halving Anniversary', category: 'crypto', importance: 'signal' },
  { date: '2025-03-13', title: 'Ethereum Dencun Anniversary', category: 'crypto', importance: 'signal' },
]

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`
}

function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`
}

// 이벤트 캘린더 컴포넌트 — 월별 달력에 경제/크립토 주요 이벤트를 색상 점으로 표시
// 날짜 클릭 시 해당 날짜의 이벤트 목록을 하단에 표시
export default function EventCalendar() {
  // currentDate: 현재 보고 있는 월 (화살표로 이전/다음 월 이동 가능)
  const [currentDate, setCurrentDate] = useState(() => new Date())
  // selectedDay: 사용자가 클릭한 날짜 (이벤트 상세 보기용)
  const [selectedDay, setSelectedDay] = useState<number | null>(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month

  // 현재 월의 이벤트를 날짜별로 그룹화하여 빠르게 조회할 수 있도록 매핑
  const eventsByDay = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>()
    const prefix = `${year}-${pad(month + 1)}-`
    for (const evt of HARDCODED_EVENTS) {
      if (evt.date.startsWith(prefix)) {
        const day = parseInt(evt.date.slice(8), 10)
        if (!map.has(day)) map.set(day, [])
        map.get(day)!.push(evt)
      }
    }
    return map
  }, [year, month])

  // 달력 그리드 생성 — 42칸 (6주 x 7일)으로 이전 월/현재 월/다음 월 날짜 채움
  const firstDayOfMonth = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrevMonth = new Date(year, month, 0).getDate()

  const cells: Array<{ day: number; isCurrentMonth: boolean }> = []

  // Previous month trailing days
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    cells.push({ day: daysInPrevMonth - i, isCurrentMonth: false })
  }
  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, isCurrentMonth: true })
  }
  // Next month leading days
  const remaining = 42 - cells.length
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, isCurrentMonth: false })
  }

  // 이전 월/다음 월로 이동하는 버튼 핸들러
  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1))
    setSelectedDay(null)
  }
  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1))
    setSelectedDay(null)
  }

  const monthName = currentDate.toLocaleString('en-US', { month: 'long' })

  const selectedEvents = selectedDay ? eventsByDay.get(selectedDay) ?? [] : []

  return (
    <div className="h-full flex flex-col p-2 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <button
          onClick={prevMonth}
          className="text-t3 hover:text-t1 transition-colors px-1.5 py-0.5 text-xs font-mono"
        >
          ◀
        </button>
        <span className="text-[11px] font-rajdhani font-bold text-t1 tracking-wider">
          {monthName} {year}
        </span>
        <button
          onClick={nextMonth}
          className="text-t3 hover:text-t1 transition-colors px-1.5 py-0.5 text-xs font-mono"
        >
          ▶
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-0 mb-1 flex-shrink-0">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="text-center text-[8px] font-mono text-t4 font-bold tracking-wider py-0.5"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0 flex-1 min-h-0">
        {cells.map((cell, i) => {
          const isToday = isCurrentMonth && cell.isCurrentMonth && cell.day === today.getDate()
          const events = cell.isCurrentMonth ? eventsByDay.get(cell.day) ?? [] : []
          const isSelected = cell.isCurrentMonth && cell.day === selectedDay

          return (
            <button
              key={i}
              onClick={() => {
                if (cell.isCurrentMonth) {
                  setSelectedDay(cell.day === selectedDay ? null : cell.day)
                }
              }}
              className={`
                relative flex flex-col items-center justify-start py-0.5 text-[9px] font-mono
                transition-colors rounded-sm
                ${cell.isCurrentMonth ? 'text-t2 hover:bg-white/5 cursor-pointer' : 'text-t4/40 cursor-default'}
                ${isToday ? 'border border-purple-500/50 rounded' : ''}
                ${isSelected ? 'bg-white/10' : ''}
              `}
            >
              <span className={isToday ? 'text-purple-400 font-bold' : ''}>{cell.day}</span>
              {/* Event dots */}
              {events.length > 0 && (
                <div className="flex items-center gap-0.5 mt-0.5">
                  {events.slice(0, 3).map((evt, j) => (
                    <span
                      key={j}
                      className="w-1 h-1 rounded-full flex-shrink-0"
                      style={{ backgroundColor: CATEGORY_COLOR[evt.category] }}
                    />
                  ))}
                  {events.length > 3 && (
                    <span className="text-[6px] text-t4">+{events.length - 3}</span>
                  )}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {/* Selected day events */}
      {selectedDay !== null && (
        <div className="mt-1 border-t border-white/5 pt-1.5 flex-shrink-0 max-h-[120px] overflow-y-auto feed-scrollbar">
          <div className="text-[9px] font-rajdhani font-bold text-t3 tracking-wider mb-1">
            {monthName} {selectedDay}, {year}
          </div>
          {selectedEvents.length === 0 ? (
            <div className="text-[9px] font-mono text-t4">No events</div>
          ) : (
            selectedEvents.map((evt, i) => (
              <div key={i} className="flex items-center gap-1.5 py-0.5">
                <span
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: CATEGORY_COLOR[evt.category] }}
                />
                <span className="text-[9px] font-mono text-t2 truncate flex-1">{evt.title}</span>
                <span
                  className="text-[7px] font-mono font-bold px-1 rounded flex-shrink-0"
                  style={{
                    color: IMPORTANCE_COLOR[evt.importance],
                    backgroundColor: `${IMPORTANCE_COLOR[evt.importance]}15`,
                  }}
                >
                  {evt.importance.toUpperCase()}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
