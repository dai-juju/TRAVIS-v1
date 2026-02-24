import { useCanvasStore } from '../stores/useCanvasStore'
import NodeEdge from './NodeEdge'

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
