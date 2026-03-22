/**
 * PageViewTracker — Fires PostHog pageview events on SPA route changes.
 *
 * Renders nothing. Must be placed inside <BrowserRouter>.
 *
 * Plausible pageviews are handled automatically by the script tag in
 * index.html (it detects History.pushState). Custom Plausible events
 * still go through src/lib/plausible.ts.
 */

import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { getPostHogInstance } from '../../main'

export function PageViewTracker() {
  const location = useLocation()

  useEffect(() => {
    getPostHogInstance()?.capture('$pageview', {
      $current_url: window.location.href,
    })
  }, [location.pathname, location.search])

  return null
}
