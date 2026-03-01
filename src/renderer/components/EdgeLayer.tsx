import { useCanvasStore } from '../stores/useCanvasStore'
import NodeEdge from './NodeEdge'

// 연결선 레이어 컴포넌트 — 캔버스 위 카드 간의 관계를 선으로 표시
// 기본적으로 숨겨져 있고, 카드에 마우스를 올리거나 고정(pin) 시 표시
// 좌상단 "EDGES ON/OFF" 버튼으로 모든 연결선을 한번에 표시/숨김 전환 가능
export default function EdgeLayer() {
  const edges = useCanvasStore((s) => s.edges)
  const showAllEdges = useCanvasStore((s) => s.showAllEdges)
  const toggleShowAllEdges = useCanvasStore((s) => s.toggleShowAllEdges)

  return (
    <>
      <svg
        width="10000"
        height="10000"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      >
        {edges.map((edge) => (
          <NodeEdge key={edge.id} edge={edge} />
        ))}
      </svg>

      {/* 연결선이 하나라도 있을 때 좌상단에 토글 버튼 표시 */}
      {edges.length > 0 && (
        <div
          style={{
            position: 'fixed',
            top: 80,
            left: 12,
            pointerEvents: 'auto',
            zIndex: 20,
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              toggleShowAllEdges()
            }}
            className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold tracking-wider transition-colors border ${
              showAllEdges
                ? 'bg-pb/20 text-pb border-pb/30'
                : 'bg-card/80 text-t3 border-white/5 hover:text-t2'
            }`}
            title={showAllEdges ? 'Hide all edges' : 'Show all edges'}
          >
            ◇ EDGES {showAllEdges ? 'ON' : 'OFF'}
          </button>
        </div>
      )}
    </>
  )
}
