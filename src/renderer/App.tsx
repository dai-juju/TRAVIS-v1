import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import BootSequence from './components/BootSequence'
import TabBar from './components/TabBar'
import Canvas from './components/Canvas'
import ChatPanel from './components/ChatPanel'
import StatusBar from './components/StatusBar'
import PriceTicker from './components/PriceTicker'
import InvestigationMode from './components/InvestigationMode'
import { dataSourceManager } from './services/dataSource'
import { BinanceDataSource } from './services/binanceWs'
import { useRealtimeStore } from './stores/useRealtimeStore'
import { useInvestigationStore } from './stores/useInvestigationStore'
import { useTabStore } from './stores/useTabStore'

function App() {
  const [booting, setBooting] = useState(true)
  const investigationOpen = useInvestigationStore((s) => s.isOpen)
  const activeTab = useTabStore((s) => s.activeTab)

  // DataSourceManager 초기화 (앱 시작 시 1회)
  useEffect(() => {
    const binance = new BinanceDataSource()
    binance.onTicker = (data) => {
      useRealtimeStore.getState().updateTicker(data)
    }
    binance.onStatusChange = (status) => {
      useRealtimeStore.getState().setConnectionStatus(status)
    }
    dataSourceManager.registerSource(binance)
    dataSourceManager.connectAll()

    return () => dataSourceManager.disconnectAll()
  }, [])

  return (
    <div className="h-screen w-screen bg-void overflow-hidden flex flex-col">
      {booting ? (
        <BootSequence onComplete={() => setBooting(false)} />
      ) : (
        <>
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
              <Canvas />
              <ChatPanel />
            </div>

            {/* FEED tab — placeholder */}
            {activeTab === 'feed' && (
              <div className="h-full flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <span className="text-2xl font-rajdhani font-bold text-t3 tracking-widest">
                    ◈ FEED
                  </span>
                  <span className="text-sm text-t4 font-mono">
                    Coming soon
                  </span>
                </div>
              </div>
            )}
          </motion.div>

          <StatusBar />
          <PriceTicker />

          <AnimatePresence>
            {investigationOpen && <InvestigationMode />}
          </AnimatePresence>
        </>
      )}
    </div>
  )
}

export default App
