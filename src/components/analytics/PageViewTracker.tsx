/**
 * PageViewTracker — Fires PostHog + Plausible pageview events on route changes.
 *
 * Renders nothing. Must be placed inside <BrowserRouter> and <PostHogProvider>.
 */

import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { usePostHog } from 'posthog-js/react'
import { trackPageview } from '../../lib/plausible'

export function PageViewTracker() {
  const location = useLocation()
  const posthog = usePostHog()

  useEffect(() => {
    posthog?.capture('$pageview', { $current_url: window.location.href })
    trackPageview()
  }, [location.pathname, location.search, posthog])

  return null
}
