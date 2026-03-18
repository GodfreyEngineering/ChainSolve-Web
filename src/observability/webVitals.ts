/**
 * observability/webVitals.ts — Core Web Vitals tracking (UI-PERF-06).
 *
 * Collects LCP, CLS, INP using the web-vitals library and sends each metric
 * to /api/observability/vitals for storage in observability_events.
 *
 * Gated by OBS_ENABLED (VITE_OBS_ENABLED=true). Safe to call unconditionally
 * from main.tsx — exits early when disabled or in SSR-like environments.
 */

import { OBS_ENABLED, OBS_SAMPLE_RATE } from '../lib/env'
import { BUILD_SHA, BUILD_ENV } from '../lib/build-info'

const ENDPOINT = '/api/observability/vitals'
const SESSION_KEY = 'cs_obs_session_v1'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getSessionId(): string {
  const today = new Date().toISOString().slice(0, 10)
  try {
    const stored = localStorage.getItem(SESSION_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as { id?: string; day?: string }
      if (parsed.day === today && typeof parsed.id === 'string') {
        return parsed.id
      }
    }
    const id = crypto.randomUUID()
    localStorage.setItem(SESSION_KEY, JSON.stringify({ id, day: today }))
    return id
  } catch {
    return crypto.randomUUID()
  }
}

function getAuthHeader(): string | null {
  try {
    const keys = Object.keys(localStorage)
    const sbKey = keys.find((k) => k.includes('supabase') && k.includes('auth-token'))
    if (!sbKey) return null
    const raw = localStorage.getItem(sbKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { access_token?: string }
    const token = parsed?.access_token
    if (typeof token === 'string' && token.length > 0) return `Bearer ${token}`
  } catch {
    // best-effort
  }
  return null
}

function currentEnv(): string {
  if (BUILD_ENV === 'production') return 'production'
  if (BUILD_ENV === 'preview') return 'preview'
  return 'development'
}

function sendVital(
  metricName: string,
  value: number,
  rating: string,
  navigationType: string,
): void {
  if (!OBS_ENABLED) return
  if (Math.random() > OBS_SAMPLE_RATE) return

  const body = JSON.stringify({
    event_id: crypto.randomUUID(),
    ts: new Date().toISOString(),
    env: currentEnv(),
    app_version: BUILD_SHA,
    route_path: window.location.pathname,
    session_id: getSessionId(),
    payload: {
      metric_name: metricName,
      value,
      rating,
      navigation_type: navigationType,
    },
  })

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const auth = getAuthHeader()
  if (auth) headers['Authorization'] = auth

  // Use sendBeacon when available for reliability during page unload (LCP fires late)
  if (navigator.sendBeacon) {
    navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }))
  } else {
    fetch(ENDPOINT, { method: 'POST', body, headers }).catch(() => {})
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

let _initialized = false

/**
 * Register web-vitals observers for LCP, CLS, and INP.
 *
 * Each metric is reported once (when the page becomes hidden or after
 * interaction for INP). Safe to call multiple times — subsequent calls
 * are no-ops.
 */
export function initWebVitals(): void {
  if (_initialized) return
  if (!OBS_ENABLED) return
  if (typeof window === 'undefined') return
  // Respect Do Not Track (16.38)
  if (navigator.doNotTrack === '1') return

  _initialized = true

  // Dynamic import to keep web-vitals out of the initial JS bundle
  import('web-vitals')
    .then(({ onLCP, onCLS, onINP }) => {
      onLCP((metric) => {
        sendVital('LCP', metric.value, metric.rating, metric.navigationType)
      })
      onCLS((metric) => {
        sendVital('CLS', metric.value, metric.rating, metric.navigationType)
      })
      onINP((metric) => {
        sendVital('INP', metric.value, metric.rating, metric.navigationType)
      })
    })
    .catch(() => {
      // Never propagate observability failures to the app
    })
}
