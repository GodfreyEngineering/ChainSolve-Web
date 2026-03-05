import type { CSSProperties } from 'react'

interface SkeletonProps {
  width?: string | number
  height?: string | number
  borderRadius?: string | number
  style?: CSSProperties
}

const baseStyle: CSSProperties = {
  background:
    'linear-gradient(90deg, var(--surface-2, #2e2e2e) 25%, var(--surface-3, #383838) 50%, var(--surface-2, #2e2e2e) 75%)',
  backgroundSize: '200% 100%',
  animation: 'cs-skeleton-shimmer 1.5s ease-in-out infinite',
  borderRadius: 'var(--radius-md)',
}

export function Skeleton({ width = '100%', height = 16, borderRadius, style }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      style={{
        ...baseStyle,
        width,
        height,
        ...(borderRadius != null ? { borderRadius } : {}),
        ...style,
      }}
    />
  )
}
