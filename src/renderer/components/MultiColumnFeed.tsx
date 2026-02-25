import FeedColumn from './FeedColumn'
import type { FeedCategory } from '../types'

const COLUMNS: { category: FeedCategory; label: string; color: string }[] = [
  { category: 'macro',    label: 'MACRO',    color: '#f59e0b' },
  { category: 'crypto',   label: 'CRYPTO',   color: '#a855f7' },
  { category: 'onchain',  label: 'ON-CHAIN', color: '#22d3ee' },
  { category: 'exchange', label: 'EXCHANGE', color: '#ef4444' },
  { category: 'social',   label: 'SOCIAL',   color: '#22c55e' },
  { category: 'stocks',   label: 'STOCKS',   color: '#3b82f6' },
  { category: 'world',    label: 'WORLD',    color: '#ec4899' },
]

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
