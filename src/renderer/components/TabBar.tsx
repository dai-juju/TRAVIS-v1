import { useTabStore } from '../stores/useTabStore'

const TABS = [
  { key: 'command' as const, label: '◈ COMMAND' },
  { key: 'feed' as const, label: '◈ FEED' },
]

export default function TabBar() {
  const activeTab = useTabStore((s) => s.activeTab)
  const setTab = useTabStore((s) => s.setTab)

  return (
    <div className="flex items-center gap-0 bg-deep border-b border-white/5 select-none px-2">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key
        return (
          <button
            key={tab.key}
            onClick={() => setTab(tab.key)}
            className={`relative px-5 py-2.5 text-xs font-rajdhani font-bold tracking-widest transition-colors ${
              isActive ? 'text-t1' : 'text-t3 hover:text-t2'
            }`}
          >
            {tab.label}
            {isActive && (
              <div
                className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-pb"
                style={{ boxShadow: '0 0 8px rgba(168,85,247,0.6), 0 0 20px rgba(168,85,247,0.2)' }}
              />
            )}
          </button>
        )
      })}
    </div>
  )
}
