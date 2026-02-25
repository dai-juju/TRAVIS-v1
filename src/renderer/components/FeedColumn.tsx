import { useMemo } from 'react'
import { useFeedStore } from '../stores/useFeedStore'
import FeedItem from './FeedItem'
import type { FeedCategory } from '../types'

interface FeedColumnProps {
  category: FeedCategory
  label: string
  color: string
}

export default function FeedColumn({ category, label, color }: FeedColumnProps) {
  const items = useFeedStore((s) => s.items)

  const categoryItems = useMemo(
    () => items.filter((item) => item.category === category),
    [items, category]
  )

  return (
    <div className="flex-1 min-w-0 flex flex-col border-r border-white/5 last:border-r-0">
      {/* Column header */}
      <div
        className="h-7 flex items-center justify-between px-2 border-b flex-shrink-0"
        style={{ borderBottomColor: `${color}40` }}
      >
        <div className="flex items-center gap-1.5">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: color }}
          />
          <span
            className="text-[10px] font-rajdhani font-bold tracking-widest"
            style={{ color }}
          >
            {label}
          </span>
        </div>
        <span className="text-[9px] font-mono text-t4">{categoryItems.length}</span>
      </div>

      {/* Scrollable items */}
      <div className="flex-1 overflow-y-auto feed-scrollbar">
        {categoryItems.length === 0 ? (
          <div className="flex items-center justify-center h-20">
            <span className="text-[10px] font-mono text-t4">No items</span>
          </div>
        ) : (
          categoryItems.map((item) => (
            <FeedItem key={item.id} item={item} />
          ))
        )}
      </div>
    </div>
  )
}
