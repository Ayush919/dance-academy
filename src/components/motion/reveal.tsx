'use client'

import { motion, useReducedMotion, type HTMLMotionProps } from 'motion/react'

const EASE = [0.22, 1, 0.36, 1] as const

type RevealProps = HTMLMotionProps<'div'> & {
  /** Seconds before the reveal starts. */
  delay?: number
  /** Distance travelled upward, in px. */
  y?: number
}

/** Fades and lifts content into place the first time it scrolls into view. */
export function Reveal({ delay = 0, y = 24, children, ...props }: RevealProps) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      transition={{ duration: 0.8, ease: EASE, delay }}
      {...props}
    >
      {children}
    </motion.div>
  )
}

/**
 * Reveals a headline line by line, each line sliding up from a mask. Visibility is observed on the
 * unclipped wrapper: a line that starts outside its mask has no visible area, so observing the
 * line itself would never fire.
 */
export function RevealLines({
  lines,
  className,
  lineClassName,
  delay = 0,
}: {
  lines: React.ReactNode[]
  className?: string
  lineClassName?: string
  delay?: number
}) {
  const reduce = useReducedMotion()
  return (
    <motion.span
      className={`block ${className ?? ''}`}
      initial={reduce ? false : 'hidden'}
      whileInView="visible"
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
    >
      {lines.map((line, i) => (
        <span key={i} className="block overflow-hidden pb-[0.06em]">
          <motion.span
            className={`block ${lineClassName ?? ''}`}
            variants={{
              hidden: { y: '105%' },
              visible: { y: 0, transition: { duration: 0.9, ease: EASE, delay: delay + i * 0.08 } },
            }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </motion.span>
  )
}
