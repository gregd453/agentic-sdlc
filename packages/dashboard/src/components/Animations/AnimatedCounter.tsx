import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

interface AnimatedCounterProps {
  value: number
  duration?: number
  className?: string
}

export default function AnimatedCounter({
  value,
  duration = 1,
  className = '',
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    let startTime: number
    let animationFrame: number

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / (duration * 1000), 1)
      const currentValue = Math.floor(progress * value)

      setDisplayValue(currentValue)

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate)
      }
    }

    animationFrame = requestAnimationFrame(animate)

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame)
    }
  }, [value, duration])

  return (
    <motion.span
      className={className}
      initial={{ scale: 0.8 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 100 }}
    >
      {displayValue.toLocaleString()}
    </motion.span>
  )
}
