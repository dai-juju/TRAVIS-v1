import { useTabStore } from '../stores/useTabStore'

// 탭 정의 — COMMAND(캔버스+채팅 모드)와 FEED(전체 피드 보기) 두 가지
const TABS = [
  { key: 'command' as const, label: '◈ COMMAND' },
  { key: 'feed' as const, label: '◈ FEED' },
]

// 상단 탭 바 컴포넌트 — COMMAND 탭과 FEED 탭 사이를 전환하는 네비게이션
export default function TabBar() {
  // 현재 활성화된 탭
  const activeTab = useTabStore((s) => s.activeTab)
  // 탭 변경 함수
  const setTab = useTabStore((s) => s.setTab)

  return (
    <div className="flex items-center gap-0 bg-deep border-b border-white/5 select-none px-2">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key
        return (
          // 탭 버튼 — 클릭 시 해당 탭으로 전환
          <button
            key={tab.key}
            onClick={() => setTab(tab.key)}
            className={`relative px-5 py-2.5 text-xs font-rajdhani font-bold tracking-widest transition-colors ${
              isActive ? 'text-t1' : 'text-t3 hover:text-t2'
            }`}
          >
            {tab.label}
            {/* 활성 탭 하단에 보라색 강조 표시 */}
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
