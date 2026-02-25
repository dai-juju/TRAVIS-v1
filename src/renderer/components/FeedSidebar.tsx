import { useState, useRef, useEffect, useMemo } from 'react'
import { useFeedStore } from '../stores/useFeedStore'
import FeedItem from './FeedItem'
import type { FeedCategory } from '../types'

const ALL_CATEGORIES: { key: FeedCategory; label: string; color: string }[] = [
  { key: 'macro',    label: 'MACRO',    color: '#f59e0b' },
  { key: 'crypto',   label: 'CRYPTO',   color: '#a855f7' },
  { key: 'onchain',  label: 'ON-CHAIN', color: '#22d3ee' },
  { key: 'exchange', label: 'EXCHANGE', color: '#ef4444' },
  { key: 'social',   label: 'SOCIAL',   color: '#22c55e' },
  { key: 'stocks',   label: 'STOCKS',   color: '#3b82f6' },
  { key: 'world',    label: 'WORLD',    color: '#ec4899' },
]

export default function FeedSidebar() {
  const items = useFeedStore((s) => s.items)
  const [selectedCategories, setSelectedCategories] = useState<Set<FeedCategory>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const isHovered = useRef(false)
  const prevCountRef = useRef(0)

  const toggleCategory = (cat: FeedCategory) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const filteredItems = useMemo(() => {
    const term = searchTerm.toLowerCase()
    return items.filter((item) => {
      if (selectedCategories.size > 0 && !selectedCategories.has(item.category)) return false
      if (term && !item.title.toLowerCase().includes(term)) return false
      return true
    })
  }, [items, selectedCategories, searchTerm])

  // Auto-scroll on new items
  useEffect(() => {
    if (filteredItems.length > prevCountRef.current && !isHovered.current && scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
    prevCountRef.current = filteredItems.length
  }, [filteredItems.length])

  const isConnected = items.length > 0

  return (
    <div className="w-[300px] flex-shrink-0 bg-deep border-l border-white/5 flex flex-col">
      {/* Header */}
      <div className="h-9 flex items-center justify-between px-3 border-b border-white/5">
        <span className="text-[11px] font-rajdhani font-bold text-t3 tracking-widest">
          ALL FEEDS
        </span>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-mono text-t4">{filteredItems.length}</span>
          <div className={`w-1.5 h-1.5 rounded-full ${
            isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
          }`} />
        </div>
      </div>

      {/* Search bar */}
      <div className="px-2 py-1.5 border-b border-white/5">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search feeds..."
          className="w-full bg-white/5 text-[11px] text-t1 placeholder-t4 px-2 py-1 rounded border border-white/5 focus:border-purple-500/50 focus:outline-none font-mono"
        />
      </div>

      {/* Category filter chips */}
      <div className="px-2 py-1.5 flex flex-wrap gap-1 border-b border-white/5">
        {ALL_CATEGORIES.map(({ key, label, color }) => {
          const isActive = selectedCategories.size === 0 || selectedCategories.has(key)
          return (
            <button
              key={key}
              onClick={() => toggleCategory(key)}
              className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded transition-all duration-150"
              style={{
                backgroundColor: isActive ? `${color}20` : 'rgba(255,255,255,0.03)',
                color: isActive ? color : 'var(--t4)',
                border: `1px solid ${isActive ? `${color}40` : 'transparent'}`,
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Scrollable feed list */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto feed-scrollbar"
        onMouseEnter={() => { isHovered.current = true }}
        onMouseLeave={() => { isHovered.current = false }}
      >
        {filteredItems.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <span className="text-xs font-mono text-t4">
              {items.length === 0 ? 'Connecting...' : 'No matching items'}
            </span>
          </div>
        ) : (
          filteredItems.map((item) => (
            <FeedItem key={item.id} item={item} />
          ))
        )}
      </div>
    </div>
  )
}
