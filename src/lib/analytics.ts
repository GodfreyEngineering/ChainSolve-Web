/**
 * analytics.ts — Unified analytics abstraction for ChainSolve.
 *
 * All tracking calls go through this module. Nothing else imports PostHog
 * or Plausible directly (except main.tsx for initialisation).
 *
 * PostHog receives every event (product analytics).
 * Plausible receives only high-value conversion events (traffic analytics).
 */

import { usePostHog } from 'posthog-js/react'
import { trackEvent as plausibleTrack } from './plausible'

// ── Event definitions ────────────────────────────────────────────────────────

type ChainSolveEvent =
  | {
      name: 'calculation_run'
      props: { node_count: number; duration_ms: number; success: boolean; error_code?: string }
    }
  | { name: 'node_added'; props: { node_type: string } }
  | { name: 'node_connected'; props: { source_type: string; target_type: string } }
  | { name: 'graph_saved'; props: { node_count: number; edge_count: number } }
  | { name: 'graph_exported'; props: { format: 'pdf' | 'csv' | 'json' | 'xlsx' } }
  | { name: 'template_used'; props: { template_id: string; template_name: string } }
  | { name: 'subscription_upgrade_clicked'; props: { from_tier: string; to_tier: string } }
  | { name: 'onboarding_step_completed'; props: { step: number; step_name: string } }
  | { name: 'sign_up_completed'; props: { method: 'email' | 'google' | 'github' } }
  | { name: 'feedback_submitted'; props: { type: 'bug' | 'improvement' | 'question' } }

// High-value events that also fire to Plausible (traffic-level conversions)
const PLAUSIBLE_EVENTS = new Set<string>([
  'sign_up_completed',
  'subscription_upgrade_clicked',
  'graph_exported',
  'calculation_run',
])

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useAnalytics() {
  const posthog = usePostHog()

  return {
    track: (event: ChainSolveEvent) => {
      // Always send to PostHog
      posthog?.capture(event.name, event.props)

      // Send key conversion events to Plausible too
      if (PLAUSIBLE_EVENTS.has(event.name)) {
        plausibleTrack(event.name, event.props as Record<string, string | number | boolean>)
      }
    },
  }
}
