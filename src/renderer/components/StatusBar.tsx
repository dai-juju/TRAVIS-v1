import { useRealtimeStore } from '../stores/useRealtimeStore'

const STATUS_CONFIG = {
  connected: { color: '#22c55e', text: 'Connected to Binance' },
  connecting: { color: '#eab308', text: 'Connecting...' },
  reconnecting: { color: '#eab308', text: 'Reconnecting...' },
  disconnected: { color: '#6b7280', text: 'Disconnected' },
} as const

export default function StatusBar() {
  const connectionStatus = useRealtimeStore((s) => s.connectionStatus)
  const config = STATUS_CONFIG[connectionStatus]

  return (
    <div className="h-6 flex items-center px-3 bg-deep border-t border-white/5 select-none">
      <div className="flex items-center gap-1.5">
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: config.color }}
        />
        <span className="text-[10px] font-mono text-t3">
          {config.text}
        </span>
      </div>
    </div>
  )
}
