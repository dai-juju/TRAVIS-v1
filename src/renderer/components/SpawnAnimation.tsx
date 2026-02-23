import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

interface SpawnAnimationProps {
  x: number
  y: number
  width: number
  height: number
  delay?: number
  children: ReactNode
}

export default function SpawnAnimation({
  x,
  y,
  width,
  height,
  delay = 0,
  children,
}: SpawnAnimationProps) {
  return (
    <motion.div
      className="absolute spawn-glow"
      style={{
        left: x,
        top: y,
        width,
        minHeight: height,
      }}
      initial={{ scale: 0.3, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0, transition: { duration: 0.2 } }}
      transition={{
        delay,
        duration: 0.5,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {/* 내부 콘텐츠는 약간 더 늦게 페이드인 */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          delay: delay + 0.25,
          duration: 0.3,
          ease: 'easeOut',
        }}
        className="h-full"
      >
        {children}
      </motion.div>
    </motion.div>
  )
}
