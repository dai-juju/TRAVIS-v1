import type { FeedItem as FeedItemType, FeedCategory, FeedImportance } from '../types'

// 카테고리별 왼쪽 테두리 색상 — 뉴스 항목의 카테고리를 시각적으로 구분
const CATEGORY_COLORS: Record<FeedCategory, string> = {
  macro: '#f59e0b',
  crypto: '#a855f7',
  onchain: '#22d3ee',
  exchange: '#ef4444',
  social: '#22c55e',
  stocks: '#3b82f6',
  world: '#ec4899',
}

// 중요도별 뱃지 스타일 — CRIT(긴급), ALERT(주의), SIG(신호), info는 뱃지 없음
const IMPORTANCE_BADGE: Record<FeedImportance, { label: string; bg: string; text: string } | null> = {
  critical: { label: 'CRIT', bg: 'rgba(239,68,68,0.2)', text: '#f87171' },
  alert: { label: 'ALERT', bg: 'rgba(245,158,11,0.2)', text: '#fbbf24' },
  signal: { label: 'SIG', bg: 'rgba(168,85,247,0.2)', text: '#c084fc' },
  info: null,
}

// 중요도별 제목 텍스트 스타일 — 높은 중요도일수록 밝고 굵게 표시
const TITLE_CLASSES: Record<FeedImportance, string> = {
  critical: 'text-t1 font-semibold',
  alert: 'text-t1',
  signal: 'text-t2',
  info: 'text-t3',
}

// 타임스탬프를 상대 시간으로 변환 (예: "방금", "5분 전", "2시간 전")
function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return '방금'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}분 전`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}시간 전`
  const day = Math.floor(hr / 24)
  return `${day}일 전`
}

// item: 개별 뉴스/피드 아이템 데이터
interface Props {
  item: FeedItemType
}

// 개별 뉴스 아이템 컴포넌트 — 뉴스 제목, 출처, 시간, AI 중요도 점수를 한 줄로 표시
// 클릭하면 원본 뉴스 URL을 브라우저에서 열고, 드래그하면 캔버스에 카드로 추가 가능
export default function FeedItem({ item }: Props) {
  const catColor = CATEGORY_COLORS[item.category]
  const effectiveImportance = item.aiImportance ?? item.importance
  const badge = IMPORTANCE_BADGE[effectiveImportance]
  const titleClass = TITLE_CLASSES[effectiveImportance]

  // 뉴스 아이템 클릭 시 외부 브라우저에서 원본 기사 열기
  const handleClick = () => {
    window.open(item.url, '_blank')
  }

  // 뉴스 아이템을 드래그하여 캔버스에 카드로 생성할 수 있도록 데이터 전달
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/json', JSON.stringify(item))
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <div
      className="feed-item-enter px-2 py-1.5 cursor-pointer hover:bg-white/[0.02] transition-colors border-b border-white/5"
      style={{ borderLeft: `2px solid ${catColor}` }}
      onClick={handleClick}
      draggable
      onDragStart={handleDragStart}
    >
      {/* 제목 줄 */}
      <div className="flex items-start gap-1">
        {badge && (
          <span
            className="flex-shrink-0 text-[9px] font-mono font-bold px-1 py-0.5 rounded leading-none mt-0.5"
            style={{ backgroundColor: badge.bg, color: badge.text }}
          >
            {badge.label}
          </span>
        )}
        <span className={`text-[11px] font-mono leading-tight line-clamp-2 ${titleClass}`}>
          {item.title}
        </span>
      </div>

      {/* 출처 + 시간 */}
      <div className="flex items-center gap-1 mt-1">
        <span className="text-[9px] font-mono text-t3 truncate">{item.source}</span>
        <span className="text-[9px] font-mono text-t4">·</span>
        <span className="text-[9px] font-mono text-t4 flex-shrink-0">{formatRelativeTime(item.timestamp)}</span>
        {item.relevanceScore != null && (
          <span className="text-[9px] font-mono text-t4 flex-shrink-0 ml-auto">{item.relevanceScore}</span>
        )}
      </div>

      {/* AI 스코어 바 — AI가 평가한 관련도 점수를 시각적 막대로 표시 (0~100%) */}
      {item.relevanceScore != null && (
        <div className="mt-1 h-[2px] rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${item.relevanceScore}%`,
              backgroundColor:
                item.relevanceScore >= 70 ? '#a855f7' : item.relevanceScore >= 40 ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
            }}
          />
        </div>
      )}
    </div>
  )
}
