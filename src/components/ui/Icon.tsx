import type { LucideIcon } from 'lucide-react'
import type { CSSProperties } from 'react'

interface IconProps {
  icon: LucideIcon
  size?: number
  strokeWidth?: number
  className?: string
  style?: CSSProperties
  'aria-label'?: string
}

export function Icon({
  icon: LucideIcon,
  size = 16,
  strokeWidth = 1.75,
  className,
  style,
  'aria-label': ariaLabel,
}: IconProps) {
  return (
    <LucideIcon
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      style={style}
      aria-label={ariaLabel}
      aria-hidden={!ariaLabel}
    />
  )
}
