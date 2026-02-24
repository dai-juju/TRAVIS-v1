import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

interface BootSequenceProps {
  onComplete: () => void
}

const STATUS_MESSAGES = [
  'Connecting to market data...',
  'AI systems online...',
  'Canvas ready.',
]

export default function BootSequence({ onComplete }: BootSequenceProps) {
  const [phase, setPhase] = useState<'dark' | 'logo' | 'status' | 'fadeout'>('dark')
  const [visibleStatuses, setVisibleStatuses] = useState(0)

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase('logo'), 300),
      setTimeout(() => {
        setPhase('status')
        setVisibleStatuses(1)
      }, 1000),
      setTimeout(() => setVisibleStatuses(2), 1600),
      setTimeout(() => setVisibleStatuses(3), 2200),
      setTimeout(() => setPhase('fadeout'), 2800),
      setTimeout(onComplete, 3500),
    ]
    return () => timers.forEach(clearTimeout)
  }, [])

  const fading = phase === 'fadeout'

  return (
    <motion.div
      className="fixed inset-0 bg-void flex flex-col items-center justify-center z-50"
      animate={{ opacity: fading ? 0 : 1 }}
      transition={{ duration: 0.6, ease: 'easeInOut' }}
    >
      {/* Logo + Rings */}
      {phase !== 'dark' && (
        <motion.div
          className="relative"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: fading ? 0 : 1, scale: fading ? 1.1 : 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          {/* Orbital rings container */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ perspective: '800px' }}
          >
            <div className="boot-ring boot-ring-1" />
            <div className="boot-ring boot-ring-2" />
          </div>

          {/* Logo text */}
          <div className="relative z-10 flex flex-col items-center">
            <div className="relative">
              {/* Glow layer */}
              <span
                className="absolute inset-0 text-6xl font-bold tracking-[0.25em] text-purple-500 blur-2xl opacity-60 select-none font-rajdhani"
                aria-hidden="true"
              >
                TRAVIS
              </span>
              {/* Gradient text */}
              <h1 className="relative text-6xl font-bold tracking-[0.25em] bg-gradient-to-br from-purple-500 to-cyan-400 bg-clip-text text-transparent font-rajdhani">
                TRAVIS
              </h1>
            </div>
            <p className="mt-3 text-sm tracking-[0.3em] uppercase text-t3 font-mono">
              Shape Your Market
            </p>
          </div>
        </motion.div>
      )}

      {/* Status messages */}
      {(phase === 'status' || phase === 'fadeout') && (
        <div className="mt-12 flex flex-col items-center gap-1.5 font-mono text-xs">
          {STATUS_MESSAGES.map((msg, i) => (
            <motion.p
              key={i}
              className="text-accent-cyan/80"
              initial={{ opacity: 0, x: -10 }}
              animate={{
                opacity: i < visibleStatuses ? (fading ? 0 : 0.8) : 0,
                x: i < visibleStatuses ? 0 : -10,
              }}
              transition={{ duration: 0.3 }}
            >
              {'> '}{msg}
            </motion.p>
          ))}
        </div>
      )}
    </motion.div>
  )
}
