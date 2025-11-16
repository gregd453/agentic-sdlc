import { ReactNode } from 'react'
import { motion } from 'framer-motion'

interface AnimatedCardProps {
  children: ReactNode
  delay?: number
  className?: string
}

export default function AnimatedCard({ children, delay = 0, className = '' }: AnimatedCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: delay * 0.1,
        ease: 'easeOut',
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
