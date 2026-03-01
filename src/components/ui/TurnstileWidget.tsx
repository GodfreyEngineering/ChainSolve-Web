/**
 * TurnstileWidget — Cloudflare Turnstile CAPTCHA integration (E2-2).
 *
 * Renders the Turnstile challenge widget when VITE_TURNSTILE_SITE_KEY is set.
 * If the key is absent (local dev), renders nothing — auth flows work without CAPTCHA.
 *
 * Usage:
 *   <TurnstileWidget onToken={setToken} onError={handleErr} />
 *
 * The parent form should wait for `onToken` before allowing submission.
 */

import { useEffect, useRef, useCallback } from 'react'
import { TURNSTILE_SITE_KEY } from '../../lib/turnstile'

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string
          callback: (token: string) => void
          'error-callback'?: (code: string) => void
          'expired-callback'?: () => void
          theme?: 'light' | 'dark' | 'auto'
          size?: 'normal' | 'compact'
        },
      ) => string
      reset: (widgetId: string) => void
      remove: (widgetId: string) => void
    }
  }
}

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

let scriptLoadPromise: Promise<void> | null = null

function loadTurnstileScript(): Promise<void> {
  if (scriptLoadPromise) return scriptLoadPromise
  if (window.turnstile) {
    scriptLoadPromise = Promise.resolve()
    return scriptLoadPromise
  }
  scriptLoadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Turnstile script'))
    document.head.appendChild(script)
  })
  return scriptLoadPromise
}

export interface TurnstileWidgetProps {
  /** Called with the CAPTCHA token when the challenge is solved. */
  onToken: (token: string) => void
  /** Called when the challenge encounters an error. */
  onError?: (code: string) => void
  /** Called when a previously-valid token expires. */
  onExpired?: () => void
}

export default function TurnstileWidget({ onToken, onError, onExpired }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  // Keep stable refs to callbacks so the mount effect can use latest values
  const onTokenRef = useRef(onToken)
  const onErrorRef = useRef(onError)
  const onExpiredRef = useRef(onExpired)

  // Sync callback refs in an effect (not during render) per React 19 rules
  useEffect(() => {
    onTokenRef.current = onToken
    onErrorRef.current = onError
    onExpiredRef.current = onExpired
  })

  const mount = useCallback(async () => {
    if (!TURNSTILE_SITE_KEY || !containerRef.current) return
    try {
      await loadTurnstileScript()
    } catch {
      onErrorRef.current?.('script_load_failed')
      return
    }
    if (!window.turnstile || !containerRef.current) return
    // Clear previous widget if any
    if (widgetIdRef.current) {
      window.turnstile.remove(widgetIdRef.current)
      widgetIdRef.current = null
    }
    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: (token: string) => onTokenRef.current(token),
      'error-callback': (code: string) => onErrorRef.current?.(code),
      'expired-callback': () => onExpiredRef.current?.(),
      theme: 'auto',
      size: 'normal',
    })
  }, [])

  useEffect(() => {
    void mount()
    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current)
        widgetIdRef.current = null
      }
    }
  }, [mount])

  if (!TURNSTILE_SITE_KEY) return null

  return <div ref={containerRef} style={{ margin: '0.75rem 0' }} />
}
