import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

// 카드 생성 애니메이션 속성 — 위치, 크기, 딜레이 시간과 내부 콘텐츠
interface SpawnAnimationProps {
  x: number       // 캔버스 위 X 좌표
  y: number       // 캔버스 위 Y 좌표
  width: number   // 카드 너비
  height: number  // 카드 높이
  delay?: number  // 등장 지연 시간 (여러 카드가 순차적으로 나타나게 하기 위함)
  children: ReactNode
}

// 카드 생성 애니메이션 컴포넌트 — AI가 카드를 만들 때 작은 크기에서 확대되며 나타나는 효과
// 카드가 사라질 때는 축소되며 페이드아웃
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
        height,
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
