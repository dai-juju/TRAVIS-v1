import { useState } from 'react'
import { motion } from 'framer-motion'
import BootSequence from './components/BootSequence'
import Canvas from './components/Canvas'
import ChatPanel from './components/ChatPanel'

function App() {
  const [booting, setBooting] = useState(true)

  return (
    <div className="h-screen w-screen bg-[#0a0a0f] overflow-hidden">
      {booting ? (
        <BootSequence onComplete={() => setBooting(false)} />
      ) : (
        <motion.div
          className="h-full w-full flex"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <Canvas />
          <ChatPanel />
        </motion.div>
      )}
    </div>
  )
}

export default App
