'use client'

import { MotionConfig } from 'motion/react'

/** Every animation in the app honours the visitor's reduced-motion preference. */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </MotionConfig>
  )
}
