/**
 * CookieConsent — 7.07: Cookie consent banner.
 *
 * Shows on first visit. Persists choice in localStorage.
 * If declined: disables Sentry and analytics (auth still works).
 */

import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getCookieConsent, setCookieConsent } from '../lib/cookieConsent'

export function CookieConsentBanner() {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Only show if the user hasn't made a choice yet
    if (getCookieConsent() === null) {
      setVisible(true)
    }
  }, [])

  const handleChoice = useCallback((choice: 'accepted' | 'declined') => {
    setCookieConsent(choice)

    if (choice === 'declined') {
      // Disable Sentry by calling close() — no further events are sent
      import('@sentry/react').then(
        (Sentry) => {
          const client = Sentry.getClient()
          if (client) void client.close()
        },
        () => {},
      )
    }

    setVisible(false)
  }, [])

  if (!visible) return null

  return (
    <div style={bannerStyle} role="dialog" aria-label="Cookie consent">
      <div style={contentStyle}>
        <p style={textStyle}>
          {t(
            'cookie.message',
            'We use essential cookies for authentication and localStorage for preferences. No tracking cookies are used.',
          )}
        </p>
        <div style={btnRow}>
          <button style={declineBtn} onClick={() => handleChoice('declined')}>
            {t('cookie.decline', 'Decline')}
          </button>
          <button style={acceptBtn} onClick={() => handleChoice('accepted')}>
            {t('cookie.accept', 'Accept')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const bannerStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: 10000,
  background: 'var(--surface-1, #1a1a2e)',
  borderTop: '1px solid var(--border, #333)',
  padding: '1rem 1.5rem',
  boxShadow: '0 -4px 16px rgba(0,0,0,0.3)',
}

const contentStyle: React.CSSProperties = {
  maxWidth: 960,
  margin: '0 auto',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '1.5rem',
  flexWrap: 'wrap',
}

const textStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.85rem',
  lineHeight: 1.5,
  flex: 1,
  minWidth: 200,
}

const btnRow: React.CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  flexShrink: 0,
}

const acceptBtn: React.CSSProperties = {
  padding: '0.45rem 1.25rem',
  borderRadius: 6,
  border: 'none',
  background: 'var(--primary, #6366f1)',
  color: '#fff',
  fontWeight: 600,
  fontSize: '0.82rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const declineBtn: React.CSSProperties = {
  padding: '0.45rem 1.25rem',
  borderRadius: 6,
  border: '1px solid var(--border, #333)',
  background: 'transparent',
  color: 'inherit',
  fontWeight: 500,
  fontSize: '0.82rem',
  cursor: 'pointer',
  fontFamily: 'inherit',
}
