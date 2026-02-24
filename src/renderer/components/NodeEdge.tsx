import { useCanvasStore } from '../stores/useCanvasStore'
import type { EdgeData, CardData } from '../types'

interface NodeEdgeProps {
  edge: EdgeData
}

function getAccentColor(cardType?: string): string {
  switch (cardType) {
    case 'price': return '#22d3ee'
    case 'analysis': return '#a855f7'
    case 'news': return '#f97316'
    case 'comparison': return '#3b82f6'
    case 'data': return '#10b981'
    case 'summary': return '#eab308'
    default: return '#a855f7'
  }
}

export default function NodeEdge({ edge }: NodeEdgeProps) {
  const cards = useCanvasStore((s) => s.cards)
  const hoveredNodeId = useCanvasStore((s) => s.hoveredNodeId)
  const pinnedNodeIds = useCanvasStore((s) => s.pinnedNodeIds)
  const showAllEdges = useCanvasStore((s) => s.showAllEdges)

  const fromNode = cards.find((c) => c.id === edge.fromNodeId)
  const toNode = cards.find((c) => c.id === edge.toNodeId)

  if (!fromNode || !toNode) return null

  // 노드 중심점
  const x1 = fromNode.x + fromNode.width / 2
  const y1 = fromNode.y + fromNode.height / 2
  const x2 = toNode.x + toNode.width / 2
  const y2 = toNode.y + toNode.height / 2

  // Visibility 로직
  const isHovered =
    hoveredNodeId === edge.fromNodeId || hoveredNodeId === edge.toNodeId
  const isPinned =
    pinnedNodeIds.includes(edge.fromNodeId) || pinnedNodeIds.includes(edge.toNodeId)
  const visible = showAllEdges || isHovered || isPinned

  // 색상: fromNode의 cardType 기준
  const fromCardType = fromNode.type === 'card' ? (fromNode as CardData).cardType : undefined
  const color = getAccentColor(fromCardType)

  // 선 스타일
  let strokeWidth: number
  let strokeDasharray: string | undefined
  switch (edge.strength) {
    case 'strong':
      strokeWidth = 2
      break
    case 'weak':
      strokeWidth = 1
      break
    case 'speculative':
      strokeWidth = 1
      strokeDasharray = '4 4'
      break
  }

  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeDasharray={strokeDasharray}
      opacity={visible ? 0.6 : 0}
      style={{ transition: 'opacity 0.2s ease' }}
    />
  )
}
