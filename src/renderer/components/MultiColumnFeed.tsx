import FeedColumn from './FeedColumn'
import type { FeedCategory } from '../types'

// 7개 카테고리 열 정의 — 각 카테고리별 이름과 색상
const COLUMNS: { category: FeedCategory; label: string; color: string }[] = [
  { category: 'macro',    label: 'MACRO',    color: '#f59e0b' },
  { category: 'crypto',   label: 'CRYPTO',   color: '#a855f7' },
  { category: 'onchain',  label: 'ON-CHAIN', color: '#22d3ee' },
  { category: 'exchange', label: 'EXCHANGE', color: '#ef4444' },
  { category: 'social',   label: 'SOCIAL',   color: '#22c55e' },
  { category: 'stocks',   label: 'STOCKS',   color: '#3b82f6' },
  { category: 'world',    label: 'WORLD',    color: '#ec4899' },
]

// 7열 카테고리별 피드 컴포넌트 — MACRO, CRYPTO, ON-CHAIN, EXCHANGE, SOCIAL, STOCKS, WORLD 7개 열로 뉴스 분류 표시
export default function MultiColumnFeed() {
  return (
    <div className="h-full flex bg-deep border-t border-white/5">
      {COLUMNS.map(({ category, label, color }) => (
        <FeedColumn
          key={category}
          category={category}
          label={label}
          color={color}
        />
      ))}
    </div>
  )
}
