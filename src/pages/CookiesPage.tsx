/**
 * CookiesPage — 16.34-16.35: Cookie Policy page.
 *
 * Accessible at /cookies. Linked from the cookie consent banner,
 * the LegalFooter, and the Privacy Policy.
 *
 * Documents every cookie, localStorage key, sessionStorage key,
 * and IndexedDB database used by the application, categorised per
 * PECR / ePrivacy Directive requirements.
 */

import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BRAND, CONTACT } from '../lib/brand'
import { LegalFooter } from '../components/ui/LegalFooter'
import { usePageMeta, useHreflang } from '../lib/seo'
import { CookieSettingsLink } from '../components/CookieConsent'
import { LegalLanguageNotice } from '../components/ui/LegalLanguageNotice'

export default function CookiesPage() {
  const { t } = useTranslation()
  usePageMeta('Cookie Policy – ChainSolve', 'ChainSolve Cookie Policy: what we store and why.')
  useHreflang('/cookies')
  const lastUpdated = '17 March 2026'

  return (
    <div style={s.page}>
      <div style={s.container}>
        <header style={s.header}>
          <Link to="/" style={s.logoLink}>
            <img src={BRAND.logoWideText} alt={t('app.name')} style={s.logo} />
          </Link>
        </header>

        <LegalLanguageNotice canonicalUrl="/cookies" />

        <article style={s.article}>
          <h1 style={s.title}>Cookie Policy</h1>
          <p style={s.meta}>Last updated: {lastUpdated}</p>

          {/* ── Overview ──────────────────────────────────────────────── */}
          <section style={s.section}>
            <h2 style={s.heading}>1. What we store and why</h2>
            <p style={s.para}>
              ChainSolve does not use traditional HTTP cookies for tracking or advertising. Instead,
              we use <strong>browser localStorage</strong>, <strong>sessionStorage</strong>, and{' '}
              <strong>IndexedDB</strong> to operate the application and remember your preferences.
            </p>
            <p style={s.para}>
              We categorise storage items as follows:
            </p>
            <ul style={s.list}>
              <li>
                <strong>Strictly necessary</strong> — required to operate the service; cannot be
                disabled without breaking core functionality.
              </li>
              <li>
                <strong>Functional</strong> — remember your preferences and settings to improve your
                experience. You can disable these but some features may not work as expected.
              </li>
              <li>
                <strong>Analytics / error reporting</strong> — used to diagnose bugs and measure
                performance. Only loaded with your consent.
              </li>
            </ul>
            <p style={s.para}>
              We use <strong>no marketing or advertising cookies</strong>, and we do not share any
              storage data with advertising networks.
            </p>
          </section>

          {/* ── Strictly Necessary ─────────────────────────────────────── */}
          <section style={s.section}>
            <h2 style={s.heading}>2. Strictly necessary storage</h2>
            <p style={s.para}>
              These items are set as soon as you use the service and cannot be declined without
              preventing the service from working.
            </p>

            <h3 style={s.subheading}>Authentication (Supabase)</h3>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Key</th>
                  <th style={s.th}>Provider</th>
                  <th style={s.th}>Purpose</th>
                  <th style={s.th}>Type</th>
                  <th style={s.th}>Expiry</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={s.td}>
                    <code>sb-*</code> / <code>supabase.auth-token</code>
                  </td>
                  <td style={s.td}>Supabase (first-party)</td>
                  <td style={s.td}>
                    Authentication session tokens (access token + refresh token). Required to keep
                    you logged in.
                  </td>
                  <td style={s.td}>localStorage / persistent</td>
                  <td style={s.td}>Until logout or session expiry (typically 1 hour; refresh token 7 days)</td>
                </tr>
                <tr>
                  <td style={s.td}>
                    <code>cs:session_id</code>
                  </td>
                  <td style={s.td}>First-party</td>
                  <td style={s.td}>
                    Current browser session UUID for single-session enforcement (prevents concurrent
                    sessions from different devices without your knowledge).
                  </td>
                  <td style={s.td}>localStorage / persistent</td>
                  <td style={s.td}>Until logout</td>
                </tr>
                <tr>
                  <td style={s.td}>
                    <code>cs:remember_me</code>
                  </td>
                  <td style={s.td}>First-party</td>
                  <td style={s.td}>
                    Whether to persist the session across browser restarts (&ldquo;Remember
                    me&rdquo; checkbox on login).
                  </td>
                  <td style={s.td}>localStorage / persistent</td>
                  <td style={s.td}>Until changed</td>
                </tr>
              </tbody>
            </table>

            <h3 style={s.subheading}>Consent</h3>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Key</th>
                  <th style={s.th}>Provider</th>
                  <th style={s.th}>Purpose</th>
                  <th style={s.th}>Type</th>
                  <th style={s.th}>Expiry</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={s.td}>
                    <code>cs:cookie-consent</code>
                  </td>
                  <td style={s.td}>First-party</td>
                  <td style={s.td}>
                    Stores your cookie consent choice (<code>accepted</code> or{' '}
                    <code>declined</code>). Required so we do not show the banner on every page
                    load.
                  </td>
                  <td style={s.td}>localStorage / persistent</td>
                  <td style={s.td}>Until you change preference</td>
                </tr>
              </tbody>
            </table>

            <h3 style={s.subheading}>Session state</h3>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Key</th>
                  <th style={s.th}>Provider</th>
                  <th style={s.th}>Purpose</th>
                  <th style={s.th}>Type</th>
                  <th style={s.th}>Expiry</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={s.td}>
                    <code>cs_chunk_error_reloaded_at</code>
                  </td>
                  <td style={s.td}>First-party</td>
                  <td style={s.td}>
                    Throttles automatic page reload when a JavaScript chunk fails to load (prevents
                    infinite reload loops on broken deployments).
                  </td>
                  <td style={s.td}>sessionStorage</td>
                  <td style={s.td}>Session (cleared when tab closes)</td>
                </tr>
              </tbody>
            </table>

            <h3 style={s.subheading}>Canvas cache (IndexedDB)</h3>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Database</th>
                  <th style={s.th}>Store</th>
                  <th style={s.th}>Purpose</th>
                  <th style={s.th}>Expiry</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={s.td}>
                    <code>chainsolve-canvas-cache</code>
                  </td>
                  <td style={s.td}>
                    <code>canvases</code>
                  </td>
                  <td style={s.td}>
                    Local cache of your computation graph snapshots. Implements
                    stale-while-revalidate: shows your last-known canvas instantly while fetching the
                    latest version from the server. Scoped to your user ID. Cleared on logout. Max
                    100 entries (LRU eviction).
                  </td>
                  <td style={s.td}>Until logout; LRU evicted after 100 entries</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* ── Functional ─────────────────────────────────────────────── */}
          <section style={s.section}>
            <h2 style={s.heading}>3. Functional storage</h2>
            <p style={s.para}>
              These items remember your preferences and UI state. They are first-party only and
              contain no personally identifiable information.
            </p>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Key</th>
                  <th style={s.th}>Purpose</th>
                  <th style={s.th}>Expiry</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ['cs:prefs', 'Centralised user preferences: angle units, number formatting, autosave interval, keyboard shortcuts, analytics opt-in, theme.', 'Until changed'],
                  ['chainsolve.theme', 'Light / dark / system theme preference.', 'Until changed'],
                  ['cs:lang', 'Selected UI language (en, es, fr, de, it, he).', 'Until changed'],
                  ['cs:libWidth', 'Block library panel width (pixels).', 'Until changed'],
                  ['cs:magneticSnap', 'Magnetic snap-to-grid toggle on the canvas.', 'Until changed'],
                  ['cs:dockCollapsed', 'Bottom dock collapse state.', 'Until changed'],
                  ['cs:inspAdvanced', 'Inspector panel advanced mode toggle.', 'Until changed'],
                  ['cs:window-geometry', 'Persisted positions/sizes of floating panels and windows.', 'Until changed'],
                  ['cs:panelLayout', 'Main UI panel dimensions (sidebar width, dock height).', 'Until changed'],
                  ['cs:recent', 'Recently-used block types (max 8) for quick access.', 'Rolling, max 8 entries'],
                  ['cs:favs', 'Favourite/starred block types.', 'Until changed'],
                  ['cs:pinned', 'Pinned blocks for quick access (max 12).', 'Until changed'],
                  ['chainsolve.recentProjects', 'Most recently opened projects (max 10) for the File menu.', 'Rolling, max 10 entries'],
                  ['cs:pinnedProjects', 'User-pinned project IDs.', 'Until changed'],
                  ['cs:onboarding-checklist', 'Tracks which onboarding steps have been completed and whether the checklist has been dismissed.', 'Until dismissed'],
                  ['cs:blockedUsers', 'Client-side list of blocked user IDs (Explore marketplace).', 'Until changed'],
                  ['chainsolve.installed_block_packs', 'Installed block pack definitions from the Explore marketplace.', 'Until uninstalled'],
                  ['cs:comment-rate', 'Timestamps for marketplace comment rate-limiting (5 per minute). Contains timestamps only, no content.', 'Rolling 60-second window'],
                  ['cs:custom-themes', 'User-defined custom theme CSS variable overrides (Pro feature).', 'Until deleted'],
                  ['cs:active-theme', 'Currently active custom theme ID.', 'Until changed'],
                  ['cs:custom-materials', 'User-defined custom material definitions (Pro feature).', 'Until deleted'],
                  ['cs:custom-functions', 'User-defined custom function block formulas (Pro feature).', 'Until deleted'],
                ].map(([key, purpose, expiry]) => (
                  <tr key={key}>
                    <td style={s.td}><code>{key}</code></td>
                    <td style={s.td}>{purpose}</td>
                    <td style={s.td}>{expiry}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* ── Analytics / Error Reporting ─────────────────────────────── */}
          <section style={s.section}>
            <h2 style={s.heading}>4. Analytics and error reporting storage</h2>
            <p style={s.para}>
              These items are only used when you have consented to analytics/error-reporting. If you
              decline, they are not set and Sentry is disabled.
            </p>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Key / Provider</th>
                  <th style={s.th}>Purpose</th>
                  <th style={s.th}>Expiry</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={s.td}>
                    <code>cs_obs_session_v1</code> (first-party)
                  </td>
                  <td style={s.td}>
                    Daily-rotating UUID for de-identified error reporting. Never linked to your user
                    account. Resets each day. Used only if our observability pipeline is enabled.
                  </td>
                  <td style={s.td}>Rotates daily</td>
                </tr>
                <tr>
                  <td style={s.td}>
                    Sentry SDK (<code>@sentry/react</code>, third-party)
                  </td>
                  <td style={s.td}>
                    Captures JavaScript exceptions and performance traces. Sentry may set its own
                    internal state in localStorage. Sentry is only initialised if{' '}
                    <code>SENTRY_DSN</code> is configured and you have consented. You can disable
                    it by declining cookie consent or via{' '}
                    <strong>Settings → Privacy → Crash reporting</strong>.
                  </td>
                  <td style={s.td}>Session-scoped; disabled immediately on opt-out</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* ── Do Not Track ───────────────────────────────────────────── */}
          <section style={s.section}>
            <h2 style={s.heading}>5. Do Not Track</h2>
            <p style={s.para}>
              ChainSolve respects the browser&rsquo;s{' '}
              <strong>Do Not Track (DNT)</strong> signal. If your browser sends{' '}
              <code>DNT: 1</code>, our observability pipeline suppresses all analytics and
              performance-timing data for your session. Error reporting (Sentry) is still used to
              detect crashes that would affect service reliability, but only if you have separately
              consented.
            </p>
          </section>

          {/* ── No Third-Party Tracking ────────────────────────────────── */}
          <section style={s.section}>
            <h2 style={s.heading}>6. No third-party tracking or advertising cookies</h2>
            <p style={s.para}>
              ChainSolve uses <strong>no Google Analytics, no Meta Pixel, no advertising
              cookies, no marketing trackers, and no social media tracking pixels</strong>.
              Our Content Security Policy (CSP) explicitly blocks any third-party scripts not in our
              whitelist.
            </p>
          </section>

          {/* ── Managing Preferences ───────────────────────────────────── */}
          <section style={s.section}>
            <h2 style={s.heading}>7. Managing your cookie preferences</h2>
            <p style={s.para}>
              You can change your cookie consent choice at any time:
            </p>
            <ul style={s.list}>
              <li>
                Use the <CookieSettingsLink /> button below.
              </li>
              <li>
                Clear all application storage via your browser&rsquo;s Developer Tools (Application
                → Storage → Clear site data).
              </li>
              <li>
                Use your browser&rsquo;s built-in cookie/storage management settings.
              </li>
            </ul>
            <p style={s.para}>
              Clearing strictly-necessary storage (authentication tokens) will log you out of
              ChainSolve.
            </p>
          </section>

          {/* ── Contact ────────────────────────────────────────────────── */}
          <section style={s.section}>
            <h2 style={s.heading}>8. Contact</h2>
            <p style={s.para}>
              Questions about this Cookie Policy? Contact us at{' '}
              <a href={`mailto:${CONTACT.support}`} style={s.link}>
                {CONTACT.support}
              </a>
              .
            </p>
          </section>
        </article>

        <footer style={s.footer}>
          <Link to="/privacy" style={s.footerLink}>
            Privacy Policy
          </Link>
          {' · '}
          <Link to="/terms" style={s.footerLink}>
            Terms &amp; Conditions
          </Link>
        </footer>
      </div>
      <LegalFooter />
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const s = {
  page: {
    minHeight: '100vh',
    padding: '2rem 1rem',
    background: 'var(--bg)',
    color: 'var(--text)',
  } as React.CSSProperties,
  container: {
    maxWidth: '900px',
    margin: '0 auto',
  } as React.CSSProperties,
  header: {
    marginBottom: '2rem',
  } as React.CSSProperties,
  logoLink: {
    display: 'inline-block',
  } as React.CSSProperties,
  logo: {
    height: 32,
  } as React.CSSProperties,
  article: {
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-xl)',
    padding: '2.5rem',
  } as React.CSSProperties,
  title: {
    margin: '0 0 0.25rem',
    fontSize: '1.75rem',
    fontWeight: 700,
  } as React.CSSProperties,
  meta: {
    margin: '0 0 2rem',
    opacity: 0.5,
    fontSize: '0.85rem',
  } as React.CSSProperties,
  section: {
    marginBottom: '1.75rem',
  } as React.CSSProperties,
  heading: {
    margin: '0 0 0.5rem',
    fontSize: '1.1rem',
    fontWeight: 600,
  } as React.CSSProperties,
  subheading: {
    margin: '1rem 0 0.4rem',
    fontSize: '0.95rem',
    fontWeight: 600,
    opacity: 0.8,
  } as React.CSSProperties,
  para: {
    margin: '0 0 0.75rem',
    fontSize: '0.92rem',
    lineHeight: 1.7,
    opacity: 0.85,
  } as React.CSSProperties,
  list: {
    margin: '0.5rem 0',
    paddingLeft: '1.5rem',
    fontSize: '0.92rem',
    lineHeight: 1.7,
    opacity: 0.85,
  } as React.CSSProperties,
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontSize: '0.82rem',
    marginBottom: '1rem',
  } as React.CSSProperties,
  th: {
    textAlign: 'left' as const,
    padding: '0.4rem 0.6rem',
    borderBottom: '1px solid var(--border)',
    fontWeight: 600,
    opacity: 0.7,
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  td: {
    padding: '0.4rem 0.6rem',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'top' as const,
    opacity: 0.85,
    lineHeight: 1.5,
  } as React.CSSProperties,
  link: {
    color: 'var(--primary)',
    textDecoration: 'underline',
  } as React.CSSProperties,
  footer: {
    marginTop: '2rem',
    textAlign: 'center' as const,
    fontSize: '0.9rem',
  } as React.CSSProperties,
  footerLink: {
    color: 'var(--primary)',
    textDecoration: 'underline',
  } as React.CSSProperties,
}
