import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import BootSequence from './components/BootSequence'
import TabBar from './components/TabBar'
import Canvas from './components/Canvas'
import ChatPanel from './components/ChatPanel'
import StatusBar from './components/StatusBar'
import PriceTicker from './components/PriceTicker'
import InvestigationMode from './components/InvestigationMode'
import NewsFeed from './components/NewsFeed'
import MosaicFeed from './components/MosaicFeed'
import { dataSourceManager } from './services/dataSource'
import { BinanceDataSource } from './services/binanceWs'
import { feedService } from './services/feedService'
import { scoringService } from './services/scoringService'
import { useRealtimeStore } from './stores/useRealtimeStore'
import { useInvestigationStore } from './stores/useInvestigationStore'
import { useTabStore } from './stores/useTabStore'
import { useFeedStore } from './stores/useFeedStore'
import { soundService } from './services/soundService'

// 앱의 최상위 컴포넌트 — 부팅 시퀀스 후 메인 화면(탭, 캔버스, 채팅, 가격 티커 등)을 표시
function App() {
  // booting: 앱이 부팅 애니메이션 중인지 여부
  const [booting, setBooting] = useState(true)
  // investigationOpen: 심층 분석 모드가 열려 있는지 여부 (카드 더블클릭 시 활성화)
  const investigationOpen = useInvestigationStore((s) => s.isOpen)
  // activeTab: 현재 선택된 탭 (COMMAND 또는 FEED)
  const activeTab = useTabStore((s) => s.activeTab)

  // 바이낸스 실시간 데이터 연결 초기화 — 앱 시작 시 1회만 실행
  // 바이낸스 WebSocket으로 실시간 가격/거래량 데이터를 수신하고, 연결 상태를 추적
  useEffect(() => {
    const binance = new BinanceDataSource()
    // 가격 데이터가 수신되면 실시간 저장소에 업데이트
    binance.onTicker = (data) => {
      useRealtimeStore.getState().updateTicker(data)
    }
    // 연결 상태 변경 시 (연결됨/연결중/끊김 등) 저장소에 반영
    binance.onStatusChange = (status) => {
      useRealtimeStore.getState().setConnectionStatus(status)
    }
    dataSourceManager.registerSource(binance)
    dataSourceManager.connectAll()

    // 앱 종료 시 모든 WebSocket 연결 해제
    return () => dataSourceManager.disconnectAll()
  }, [])

  // 뉴스 피드 서비스 초기화 — 부팅 애니메이션 완료 후 시작
  // 뉴스/피드 데이터를 외부 소스(CryptoPanic 등)에서 가져오고 AI 중요도 평가를 시작
  useEffect(() => {
    if (booting) return

    // 새 뉴스가 도착하면 피드 저장소에 추가하고, AI 스코어링 대기열에 넣음
    const unsub = feedService.onUpdate((items) => {
      useFeedStore.getState().addItems(items)
      scoringService.enqueue(items)
    })
    feedService.startAll()

    // 컴포넌트 해제 시 모든 피드 및 스코어링 서비스 정지
    return () => {
      unsub()
      feedService.stopAll()
      scoringService.stop()
    }
  }, [booting])

  // 부팅 완료 시 사운드 재생 — JARVIS 느낌의 상승 톤
  useEffect(() => {
    if (!booting) {
      soundService.playBoot()
    }
  }, [booting])

  // 화면 렌더링 — 부팅 중이면 부팅 애니메이션, 완료 후에는 메인 인터페이스 표시
  return (
    <div className="h-screen w-screen bg-void overflow-hidden flex flex-col">
      {/* 부팅 중이면 부팅 시퀀스 애니메이션 표시 */}
      {booting ? (
        <BootSequence onComplete={() => setBooting(false)} />
      ) : (
        <>
          {/* 상단 탭 바 — COMMAND / FEED 탭 전환 */}
          <TabBar />

          <motion.div
            className="flex-1 min-h-0 relative"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            {/* COMMAND tab — display toggle로 상태 보존 */}
            <div
              className="h-full flex"
              style={{ display: activeTab === 'command' ? 'flex' : 'none' }}
            >
              {/* Left: News Feed */}
              <NewsFeed />

              {/* Center: Canvas */}
              <Canvas />

              {/* Right: Chat */}
              <ChatPanel />
            </div>

            {/* FEED tab — display toggle로 상태 보존 */}
            <div
              className="h-full"
              style={{ display: activeTab === 'feed' ? 'block' : 'none' }}
            >
              <MosaicFeed />
            </div>
          </motion.div>

          {/* 하단 상태 바 — 바이낸스 연결 상태 표시 */}
          <StatusBar />
          {/* 하단 가격 티커 — BTC, ETH 등 주요 자산 실시간 가격 스크롤 */}
          <PriceTicker />

          {/* 심층 분석 모드 — 카드 더블클릭 시 전체 화면으로 6패널 분석 표시 */}
          <AnimatePresence>
            {investigationOpen && <InvestigationMode />}
          </AnimatePresence>
        </>
      )}
    </div>
  )
}

export default App
