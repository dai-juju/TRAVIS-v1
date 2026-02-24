import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import BootSequence from './components/BootSequence'
import Canvas from './components/Canvas'
import ChatPanel from './components/ChatPanel'
import StatusBar from './components/StatusBar'
import InvestigationMode from './components/InvestigationMode'
import { dataSourceManager } from './services/dataSource'
import { BinanceDataSource } from './services/binanceWs'
import { useRealtimeStore } from './stores/useRealtimeStore'
import { useInvestigationStore } from './stores/useInvestigationStore'

function App() {
  const [booting, setBooting] = useState(true)
  const investigationOpen = useInvestigationStore((s) => s.isOpen)

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
    <div className="h-screen w-screen bg-[#0a0a0f] overflow-hidden flex flex-col">
      {booting ? (
        <BootSequence onComplete={() => setBooting(false)} />
      ) : (
        <>
          <motion.div
            className="flex-1 flex min-h-0"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <Canvas />
            <ChatPanel />
          </motion.div>
          <StatusBar />

          <AnimatePresence>
            {investigationOpen && <InvestigationMode />}
          </AnimatePresence>
        </>
      )}
    </div>
  )
}

export default App
