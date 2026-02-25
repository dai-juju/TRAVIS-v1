import { useMemo, useState } from 'react'
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'
import { useFeedStore } from '../stores/useFeedStore'
import { getCoordinates } from '../utils/geoKeywords'
import type { FeedItem, FeedImportance } from '../types'

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

const IMPORTANCE_COLOR: Record<FeedImportance, string> = {
  critical: '#ef4444',
  alert: '#f59e0b',
  signal: '#a855f7',
  info: '#6b7280',
}

const IMPORTANCE_ORDER: Record<FeedImportance, number> = {
  critical: 0,
  alert: 1,
  signal: 2,
  info: 3,
}

function getTopImportance(items: FeedItem[]): FeedImportance {
  let top: FeedImportance = 'info'
  for (const item of items) {
    const imp = item.aiImportance ?? item.importance
    if (IMPORTANCE_ORDER[imp] < IMPORTANCE_ORDER[top]) {
      top = imp
    }
  }
  return top
}

interface PinGroup {
  location: string
  coordinates: [number, number]
  items: FeedItem[]
  topImportance: FeedImportance
  isRecent: boolean
}

export default function WorldMap() {
  const items = useFeedStore((s) => s.items)
  const [hoveredLocation, setHoveredLocation] = useState<string | null>(null)
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  const pinGroups = useMemo<PinGroup[]>(() => {
    const withLocation = items.filter((i) => i.location)
    const groups = new Map<string, FeedItem[]>()
    for (const item of withLocation) {
      const key = item.location!
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(item)
    }
    return Array.from(groups.entries())
      .map(([loc, groupItems]) => ({
        location: loc,
        coordinates: getCoordinates(loc),
        items: groupItems,
        topImportance: getTopImportance(groupItems),
        isRecent: groupItems.some((i) => Date.now() - i.timestamp * 1000 < 5 * 60 * 1000),
      }))
      .filter((g): g is PinGroup => g.coordinates !== null) as PinGroup[]
  }, [items])

  const hoveredGroup = pinGroups.find((g) => g.location === hoveredLocation)

  return (
    <div className="relative w-full h-full overflow-hidden bg-deep">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 130, center: [20, 20] }}
        style={{ width: '100%', height: '100%' }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="#0a0a18"
                stroke="rgba(255,255,255,0.07)"
                strokeWidth={0.5}
                style={{
                  default: { outline: 'none' },
                  hover: { fill: '#0f0f24', outline: 'none' },
                  pressed: { outline: 'none' },
                }}
              />
            ))
          }
        </Geographies>

        {pinGroups.map((group) => (
          <Marker key={group.location} coordinates={group.coordinates}>
            {/* Pulse ring for recent items */}
            {group.isRecent && (
              <circle
                r={8}
                fill="none"
                stroke={IMPORTANCE_COLOR[group.topImportance]}
                strokeWidth={1}
                className="animate-ping"
                opacity={0.6}
              />
            )}
            {/* Main pin */}
            <circle
              r={4}
              fill={IMPORTANCE_COLOR[group.topImportance]}
              stroke="rgba(0,0,0,0.5)"
              strokeWidth={0.5}
              style={{ cursor: 'pointer' }}
              onMouseEnter={(e) => {
                setHoveredLocation(group.location)
                setTooltipPos({ x: e.clientX, y: e.clientY })
              }}
              onMouseLeave={() => setHoveredLocation(null)}
              onClick={() => {
                if (group.items[0]?.url) {
                  window.open(group.items[0].url, '_blank')
                }
              }}
            />
            {/* Item count badge */}
            {group.items.length > 1 && (
              <text
                textAnchor="middle"
                y={-8}
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 8,
                  fill: IMPORTANCE_COLOR[group.topImportance],
                  pointerEvents: 'none',
                }}
              >
                {group.items.length}
              </text>
            )}
          </Marker>
        ))}
      </ComposableMap>

      {/* Tooltip */}
      {hoveredGroup && hoveredLocation && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{ left: tooltipPos.x + 12, top: tooltipPos.y - 8 }}
        >
          <div className="bg-card border border-white/10 rounded px-3 py-2 shadow-xl max-w-[260px]">
            <div className="text-[10px] font-rajdhani font-bold text-t2 tracking-wider mb-1">
              {hoveredGroup.location.toUpperCase()} ({hoveredGroup.items.length})
            </div>
            {hoveredGroup.items.slice(0, 3).map((item) => (
              <div key={item.id} className="text-[10px] font-mono text-t2 truncate leading-relaxed">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 flex-shrink-0"
                  style={{
                    backgroundColor: IMPORTANCE_COLOR[item.aiImportance ?? item.importance],
                    verticalAlign: 'middle',
                  }}
                />
                {item.title}
              </div>
            ))}
            {hoveredGroup.items.length > 3 && (
              <div className="text-[9px] font-mono text-t4 mt-1">
                +{hoveredGroup.items.length - 3} more
              </div>
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {pinGroups.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[10px] font-mono text-t4">Waiting for geo-tagged news...</span>
        </div>
      )}
    </div>
  )
}
