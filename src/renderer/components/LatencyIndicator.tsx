// latency: 데이터 지연 시간 (밀리초). null이면 데이터 없음
interface LatencyIndicatorProps {
  latency: number | null
}

// 데이터 지연 시간 표시기 — 카드 헤더에 표시되는 실시간 데이터의 지연 상태
// 1초 미만: 초록(양호), 1~5초: 노랑(주의), 5초 이상: 빨강(지연), 데이터 없음: 회색
export default function LatencyIndicator({ latency }: LatencyIndicatorProps) {
  let color: string
  let label: string

  if (latency === null) {
    color = '#6b7280' // gray
    label = '--'
  } else if (latency < 1000) {
    color = '#22c55e' // green
    label = `${(latency / 1000).toFixed(1)}s`
  } else if (latency < 5000) {
    color = '#eab308' // yellow
    label = `${(latency / 1000).toFixed(1)}s`
  } else {
    color = '#ef4444' // red
    label = `${(latency / 1000).toFixed(0)}s`
  }

  return (
    <div className="flex items-center gap-1 flex-shrink-0" title={`Latency: ${latency ?? 'N/A'}ms`}>
      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[9px] font-mono" style={{ color }}>{label}</span>
    </div>
  )
}
