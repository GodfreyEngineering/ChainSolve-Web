/**
 * RouteSkeleton — Route-level loading skeleton (J4-1).
 *
 * Variants:
 *   - "page":    Full-page centered skeleton with header bar and content blocks.
 *   - "canvas":  Canvas-like skeleton with toolbar strip and main area.
 *   - "minimal": Just the pulsing logo (for lightweight routes like docs/terms).
 *
 * All use CSS-only animations (no JS timers). Respects prefers-reduced-motion.
 */

export type SkeletonVariant = 'page' | 'canvas' | 'minimal'

interface RouteSkeletonProps {
  variant?: SkeletonVariant
}

// ── Shared skeleton bar ──────────────────────────────────────────────────────

const shimmerBg =
  'linear-gradient(90deg, rgba(255,255,255,0.03) 25%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 75%)'

function SkeletonBar({
  width,
  height = 12,
  style,
}: {
  width: string | number
  height?: number
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 6,
        background: shimmerBg,
        backgroundSize: '200% 100%',
        animation: 'cs-skeleton-shimmer 1.8s ease-in-out infinite',
        ...style,
      }}
    />
  )
}

// ── Page skeleton ────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header bar */}
      <div
        style={{
          height: 40,
          borderBottom: '1px solid var(--border)',
          background: 'var(--card-bg)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 1rem',
          gap: '1rem',
        }}
      >
        <SkeletonBar width={100} height={16} />
        <div style={{ flex: 1 }} />
        <SkeletonBar width={60} height={14} />
        <SkeletonBar width={26} height={26} style={{ borderRadius: '50%' }} />
      </div>

      {/* Content area */}
      <div
        style={{
          maxWidth: 800,
          margin: '3rem auto',
          padding: '0 1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
        }}
      >
        <SkeletonBar width="40%" height={24} />
        <SkeletonBar width="65%" height={14} />
        <div style={{ height: 12 }} />
        <SkeletonBar width="100%" height={80} style={{ borderRadius: 12 }} />
        <SkeletonBar width="100%" height={80} style={{ borderRadius: 12 }} />
        <SkeletonBar width="70%" height={14} />
      </div>
    </div>
  )
}

// ── Canvas skeleton ──────────────────────────────────────────────────────────

function CanvasSkeleton() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* App header */}
      <div
        style={{
          height: 36,
          borderBottom: '1px solid var(--border)',
          background: 'var(--card-bg)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 0.75rem',
          gap: '0.75rem',
        }}
      >
        <SkeletonBar width={80} height={14} />
        <div style={{ flex: 1 }} />
        <SkeletonBar width={100} height={12} />
      </div>

      {/* Canvas area */}
      <div style={{ flex: 1, position: 'relative' }}>
        {/* Toolbar strip */}
        <div
          style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 320,
            height: 36,
            borderRadius: 10,
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '0 1rem',
          }}
        >
          <SkeletonBar width={24} height={24} style={{ borderRadius: 6 }} />
          <SkeletonBar width={24} height={24} style={{ borderRadius: 6 }} />
          <SkeletonBar width={24} height={24} style={{ borderRadius: 6 }} />
          <SkeletonBar width={24} height={24} style={{ borderRadius: 6 }} />
          <SkeletonBar width={24} height={24} style={{ borderRadius: 6 }} />
        </div>
      </div>

      {/* Sheets bar */}
      <div
        style={{
          height: 32,
          borderTop: '1px solid var(--border)',
          background: 'var(--card-bg)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 0.75rem',
          gap: '0.5rem',
        }}
      >
        <SkeletonBar width={80} height={18} style={{ borderRadius: 4 }} />
        <SkeletonBar width={60} height={18} style={{ borderRadius: 4 }} />
      </div>
    </div>
  )
}

// ── Minimal skeleton ─────────────────────────────────────────────────────────

function MinimalSkeleton() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg)',
      }}
    >
      <SkeletonBar width={120} height={20} />
    </div>
  )
}

// ── Export ────────────────────────────────────────────────────────────────────

export function RouteSkeleton({ variant = 'page' }: RouteSkeletonProps) {
  if (variant === 'canvas') return <CanvasSkeleton />
  if (variant === 'minimal') return <MinimalSkeleton />
  return <PageSkeleton />
}
