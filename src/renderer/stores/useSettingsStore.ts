// Zustand — 상태 관리 라이브러리
import { create } from 'zustand'
// persist — 브라우저 로컬 스토리지에 설정을 자동 저장/복원하는 미들웨어
// (앱을 껐다 켜도 설정이 유지됨)
import { persist } from 'zustand/middleware'

// 설정 저장소의 전체 상태와 기능 정의
interface SettingsState {
  apiKey: string               // Claude AI API 키 (AI를 사용하기 위한 인증 키)
  tavilyApiKey: string         // Tavily 웹 검색 API 키 (실시간 뉴스 검색용)
  cmcApiKey: string            // CoinMarketCap API 키 (보조 시장 데이터 소스)
  contextPrompt: string        // 사용자 맞춤 컨텍스트 (예: "나는 비트코인 롱 포지션 중")
  model: string                // 사용할 AI 모델 이름
  enableAiScoring: boolean     // AI 뉴스 중요도 자동 평가 기능 켜기/끄기
  enableSound: boolean         // 사운드 피드백 (카드 생성, AI 응답 등 효과음)
  setApiKey: (key: string) => void              // API 키 변경
  setTavilyApiKey: (key: string) => void        // Tavily API 키 변경
  setCmcApiKey: (key: string) => void           // CMC API 키 변경
  setContextPrompt: (prompt: string) => void    // 컨텍스트 프롬프트 변경
  setModel: (model: string) => void             // AI 모델 변경
  setEnableAiScoring: (v: boolean) => void      // AI 스코어링 켜기/끄기
  setEnableSound: (v: boolean) => void          // 사운드 피드백 켜기/끄기
}

// ====================================================================
// 설정 저장소 — 사용자의 API 키, AI 모델, 개인 설정을 관리하는 금고
// persist로 감싸져 있어서 앱을 껐다 켜도 설정이 자동으로 복원됨
// 브라우저의 localStorage에 'travis-settings'라는 이름으로 저장됨
// ====================================================================
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      apiKey: '',                              // 처음엔 API 키가 비어있음 (사용자가 입력해야 함)
      tavilyApiKey: '',                        // Tavily 키도 처음엔 비어있음
      cmcApiKey: '',                           // CMC 키도 처음엔 비어있음
      contextPrompt: '',                       // 맞춤 컨텍스트 없음
      model: 'claude-sonnet-4-20250514',       // 기본 AI 모델
      enableAiScoring: true,                   // AI 뉴스 평가 기능은 기본 켜짐
      enableSound: true,                       // 사운드 피드백 기본 켜짐
      setApiKey: (apiKey) => set({ apiKey }),                       // API 키 저장
      setTavilyApiKey: (tavilyApiKey) => set({ tavilyApiKey }),     // Tavily API 키 저장
      setCmcApiKey: (cmcApiKey) => set({ cmcApiKey }),             // CMC API 키 저장
      setContextPrompt: (contextPrompt) => set({ contextPrompt }), // 컨텍스트 저장
      setModel: (model) => set({ model }),                         // AI 모델 변경
      setEnableAiScoring: (enableAiScoring) => set({ enableAiScoring }), // AI 스코어링 설정
      setEnableSound: (enableSound) => set({ enableSound }),       // 사운드 설정
    }),
    { name: 'travis-settings' }  // localStorage에 저장되는 키 이름
  )
)
