/**
 * PlanBadge — Shared plan badge component with tier-specific visual treatment (J3-2).
 *
 * Renders a pill-shaped badge styled per plan tier:
 *   - Free:       grey, flat, subdued
 *   - Trialing:   blue, subtle outline
 *   - Pro:        gold with animated shimmer overlay
 *   - Student:    teal, clean
 *   - Enterprise: purple with subtle glow
 *   - Past-due:   amber warning
 *   - Canceled:   red, muted
 *
 * Variants:
 *   - "badge" (default): rounded pill for settings/dashboard
 *   - "compact": tiny uppercase label for header/toolbar
 */

import { useTranslation } from 'react-i18next'
import type { Plan } from '../../lib/entitlements'
import { PLAN_COLORS } from '../../lib/planStyles'

export type PlanBadgeVariant = 'badge' | 'compact'

interface PlanBadgeProps {
  plan: Plan
  variant?: PlanBadgeVariant
  style?: React.CSSProperties
}

// ── Badge styles per plan ────────────────────────────────────────────────────

function badgeStyle(plan: Plan): React.CSSProperties {
  const color = PLAN_COLORS[plan]
  const base: React.CSSProperties = {
    display: 'inline-block',
    padding: '0.25rem 0.75rem',
    borderRadius: 999,
    fontSize: '0.8rem',
    fontWeight: 700,
    background: `${color}22`,
    color,
    border: `1px solid ${color}44`,
    position: 'relative',
    overflow: 'hidden',
  }

  if (plan === 'pro') {
    return {
      ...base,
      background: 'linear-gradient(135deg, rgba(212,160,23,0.15), rgba(212,160,23,0.25))',
      border: `1px solid ${color}66`,
      boxShadow: `0 0 8px ${color}33`,
    }
  }

  if (plan === 'enterprise') {
    return {
      ...base,
      background: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(139,92,246,0.22))',
      border: `1px solid ${color}55`,
      boxShadow: `0 0 6px ${color}22`,
      letterSpacing: '0.03em',
    }
  }

  if (plan === 'developer') {
    return {
      ...base,
      background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.25))',
      border: `1px solid ${color}55`,
      boxShadow: `0 0 8px ${color}33`,
      letterSpacing: '0.03em',
    }
  }

  return base
}

function compactStyle(plan: Plan): React.CSSProperties {
  const color = PLAN_COLORS[plan]
  const base: React.CSSProperties = {
    fontSize: '0.6rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color,
    padding: '0.1rem 0.35rem',
    borderRadius: 'var(--radius-sm)',
    border: `1px solid ${color}`,
    opacity: 0.8,
    position: 'relative',
    overflow: 'hidden',
  }

  if (plan === 'pro') {
    return {
      ...base,
      opacity: 1,
      boxShadow: `0 0 6px ${color}44`,
    }
  }

  if (plan === 'enterprise') {
    return {
      ...base,
      opacity: 1,
      boxShadow: `0 0 4px ${color}33`,
      letterSpacing: '0.06em',
    }
  }

  if (plan === 'developer') {
    return {
      ...base,
      opacity: 1,
      boxShadow: `0 0 6px ${color}44`,
      letterSpacing: '0.06em',
    }
  }

  return base
}

// Shimmer overlay for Pro badges
const shimmerOverlay: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: '-100%',
  width: '100%',
  height: '100%',
  background:
    'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)',
  animation: 'cs-badge-shimmer 3s ease-in-out infinite',
  pointerEvents: 'none',
}

// ── Component ────────────────────────────────────────────────────────────────

export function PlanBadge({ plan, variant = 'badge', style }: PlanBadgeProps) {
  const { t } = useTranslation()
  const s = variant === 'compact' ? compactStyle(plan) : badgeStyle(plan)

  return (
    <span style={{ ...s, ...style }}>
      {t(`plans.${plan}`)}
      {(plan === 'pro' || plan === 'developer') && <span style={shimmerOverlay} />}
    </span>
  )
}
