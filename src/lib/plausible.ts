/**
 * plausible.ts — Lightweight Plausible Analytics client.
 *
 * Replaces the deprecated `plausible-tracker` npm package with a direct
 * call to the Plausible Events API. This is all Plausible needs for SPAs:
 * a POST to /api/event with the domain, event name, and URL.
 *
 * Docs: https://plausible.io/docs/events-api
 */

import { PLAUSIBLE_DOMAIN } from './env'

const PLAUSIBLE_ENDPOINT = 'https://plausible.io/api/event'

interface PlausiblePayload {
  domain: string
  name: string
  url: string
  referrer?: string
  props?: Record<string, string | number | boolean>
}

function send(payload: PlausiblePayload): void {
  // Use sendBeacon for fire-and-forget; fall back to fetch
  const body = JSON.stringify(payload)
  if (navigator.sendBeacon) {
    navigator.sendBeacon(PLAUSIBLE_ENDPOINT, body)
  } else {
    fetch(PLAUSIBLE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body,
      keepalive: true,
    }).catch(() => {
      // Best-effort — never throw
    })
  }
}

/** Track a pageview at the current URL. */
export function trackPageview(): void {
  if (!import.meta.env.PROD || !PLAUSIBLE_DOMAIN) return
  send({
    domain: PLAUSIBLE_DOMAIN,
    name: 'pageview',
    url: window.location.href,
    referrer: document.referrer || undefined,
  })
}

/** Track a custom event. */
export function trackEvent(name: string, props?: Record<string, string | number | boolean>): void {
  if (!import.meta.env.PROD || !PLAUSIBLE_DOMAIN) return
  send({
    domain: PLAUSIBLE_DOMAIN,
    name,
    url: window.location.href,
    props,
  })
}
