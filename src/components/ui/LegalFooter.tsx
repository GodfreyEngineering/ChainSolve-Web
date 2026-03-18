/**
 * LegalFooter — L1-1: Thin site-wide legal footer.
 *
 * Displays company registration, contact links, and terms/privacy links.
 * Includes Cookie Settings link (16.74) that re-opens the consent banner.
 * Intended for all scrollable pages (not the fullscreen canvas).
 */

import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { CONTACT, COMPANY } from '../../lib/brand'

export function LegalFooter() {
  const { t } = useTranslation()
  const year = new Date().getFullYear()

  const handleCookieSettings = useCallback(() => {
    try {
      localStorage.removeItem('cs:cookie-consent')
    } catch {
      // localStorage unavailable
    }
    window.dispatchEvent(new CustomEvent('cs:cookie-consent-reset'))
  }, [])

  return (
    <footer style={footerStyle}>
      <div style={innerStyle}>
        <span style={copyrightStyle}>
          &copy; {year} {COMPANY.name}
        </span>
        <span style={sepStyle} aria-hidden="true">
          |
        </span>
        <span style={detailStyle}>
          {t('footer.registered', {
            jurisdiction: COMPANY.jurisdiction,
          })}
        </span>
        <span style={sepStyle} aria-hidden="true">
          |
        </span>
        <span style={detailStyle}>{t('footer.companyNo', { number: COMPANY.companyNumber })}</span>
        <span style={sepStyle} aria-hidden="true">
          |
        </span>
        <a href={`mailto:${CONTACT.support}`} style={linkStyle}>
          {CONTACT.support}
        </a>
        <span style={sepStyle} aria-hidden="true">
          |
        </span>
        <Link to="/terms" style={linkStyle}>
          {t('footer.termsLink')}
        </Link>
        <span style={sepStyle} aria-hidden="true">
          |
        </span>
        <Link to="/privacy" style={linkStyle}>
          {t('footer.privacyLink')}
        </Link>
        <span style={sepStyle} aria-hidden="true">
          |
        </span>
        <Link to="/cookies" style={linkStyle}>
          {t('footer.cookiesLink', 'Cookie Policy')}
        </Link>
        <span style={sepStyle} aria-hidden="true">
          |
        </span>
        <button onClick={handleCookieSettings} style={cookieBtnStyle}>
          {t('footer.cookieSettings', 'Cookie Settings')}
        </button>
        <span style={sepStyle} aria-hidden="true">
          |
        </span>
        <Link to="/accessibility" style={linkStyle}>
          {t('footer.accessibilityLink', 'Accessibility')}
        </Link>
        <span style={sepStyle} aria-hidden="true">
          |
        </span>
        <Link to="/de/impressum" style={linkStyle}>
          Impressum
        </Link>
      </div>
    </footer>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const footerStyle: React.CSSProperties = {
  padding: '1.25rem 1.5rem',
  borderTop: '1px solid var(--border)',
  textAlign: 'center',
  fontSize: '0.72rem',
  color: 'var(--text-faint)',
  lineHeight: 1.8,
}

const innerStyle: React.CSSProperties = {
  maxWidth: 960,
  margin: '0 auto',
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '0.15rem 0.4rem',
}

const copyrightStyle: React.CSSProperties = {
  whiteSpace: 'nowrap',
}

const detailStyle: React.CSSProperties = {
  whiteSpace: 'nowrap',
}

const sepStyle: React.CSSProperties = {
  opacity: 0.3,
}

const linkStyle: React.CSSProperties = {
  color: 'var(--text-faint)',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
  transition: 'color 0.15s',
}

const cookieBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  color: 'var(--text-faint)',
  textDecoration: 'none',
  cursor: 'pointer',
  font: 'inherit',
  fontSize: 'inherit',
  whiteSpace: 'nowrap',
  transition: 'color 0.15s',
}
