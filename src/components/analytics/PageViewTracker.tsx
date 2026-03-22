/**
 * PageViewTracker — Fires PostHog + Plausible pageview events on route changes.
 *
 * Renders nothing. Must be placed inside <BrowserRouter>.
 */

import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { trackPageview } from '../../lib/plausible'
import { getPostHogInstance } from '../../main'

export function PageViewTracker() {
  const location = useLocation()

  useEffect(() => {
    getPostHogInstance()?.capture('$pageview', { $current_url: window.location.href })
    trackPageview()
  }, [location.pathname, location.search])

  return null
}
