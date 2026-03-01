// Zustand — 상태 관리 라이브러리
import { create } from 'zustand'

// 탭 종류 정의: 'command' = AI 채팅+캔버스 화면, 'feed' = 뉴스 피드 전체 화면
type Tab = 'command' | 'feed'

// 탭 저장소의 상태와 기능 정의
interface TabStore {
  activeTab: Tab                     // 현재 활성화된 탭
  setTab: (tab: Tab) => void        // 탭 전환 함수
}

// ====================================================================
// 탭 저장소 — 현재 어떤 화면(탭)을 보고 있는지 관리하는 간단한 금고
// COMMAND 탭: AI 채팅 + 캔버스 (메인 작업 화면)
// FEED 탭: 실시간 뉴스 피드 + 세계 지도 + 캘린더
// ====================================================================
export const useTabStore = create<TabStore>((set) => ({
  activeTab: 'command',              // 앱 시작 시 COMMAND 탭이 기본
  setTab: (tab) => set({ activeTab: tab }),  // 사용자가 탭을 클릭하면 활성 탭 변경
}))
