/**
 * instrument.ts — Sentry initialisation.
 *
 * MUST be the first import in main.tsx so that Sentry is ready before
 * any other module-level code executes. This guarantees that boot-time
 * errors (broken imports, top-level throws) are captured.
 */

import * as Sentry from '@sentry/react'
import { SENTRY_DSN, APP_VERSION } from './lib/env'
import { getCookieConsent } from './lib/cookieConsent'

const cookieConsent = getCookieConsent()

try {
  if (SENTRY_DSN && cookieConsent !== 'declined') {
    Sentry.init({
      dsn: SENTRY_DSN,
      release: `chainsolve@${APP_VERSION || 'dev'}`,
      environment: import.meta.env.PROD ? 'production' : 'development',
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllInputs: true,
          maskAllText: false,
          blockAllMedia: false,
        }),
      ],
      tracesSampleRate: 1.0,
      tracePropagationTargets: [
        'localhost',
        /^https:\/\/app\.chainsolve\.co\.uk/,
        /^https:\/\/zjgfosqtnlhlfgpohnnu\.supabase\.co/,
      ],
      replaysSessionSampleRate: 0.05,
      replaysOnErrorSampleRate: 1.0,
      ignoreErrors: [
        // Benign browser noise — not actionable
        'ResizeObserver loop',
        // Expected when no session exists
        'AuthSessionMissingError',
        // User navigation / fetch cancellation
        'AbortError',
      ],
      beforeSend(event) {
        // Strip cookies from request data
        if (event.request?.cookies) delete event.request.cookies

        const message = event.exception?.values?.[0]?.value ?? ''
        // Drop benign ResizeObserver errors that slip through ignoreErrors
        if (message.includes('ResizeObserver loop')) return null
        // Drop non-error promise rejections (e.g. third-party scripts)
        if (message.includes('Non-Error promise rejection')) return null

        return event
      },
    })
  }
} catch {
  // Sentry must never prevent the app from booting
}
