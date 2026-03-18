/**
 * AccessibilityPage — 16.69, 16.73: Accessibility Statement.
 *
 * Accessible at /accessibility.
 * Documents WCAG compliance target, known limitations, and feedback contact.
 */

import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BRAND, CONTACT } from '../lib/brand'
import { LegalFooter } from '../components/ui/LegalFooter'
import { usePageMeta, useHreflang } from '../lib/seo'

export default function AccessibilityPage() {
  const { t } = useTranslation()
  usePageMeta(
    'Accessibility Statement – ChainSolve',
    'ChainSolve accessibility statement: WCAG 2.1 AA target, known limitations, and how to get help.',
  )
  useHreflang('/accessibility')
  const lastUpdated = '17 March 2026'

  return (
    <div style={s.page}>
      <div style={s.container}>
        <header style={s.header}>
          <Link to="/" style={s.logoLink}>
            <img src={BRAND.logoWideText} alt={t('app.name')} style={s.logo} />
          </Link>
        </header>

        <article style={s.article}>
          <h1 style={s.title}>Accessibility Statement</h1>
          <p style={s.meta}>Last updated: {lastUpdated}</p>

          <section style={s.section}>
            <h2 style={s.heading}>Our commitment</h2>
            <p style={s.para}>
              Godfrey Engineering Ltd is committed to making ChainSolve accessible to as many
              people as possible. We aim to meet the{' '}
              <a
                href="https://www.w3.org/TR/WCAG21/"
                style={s.link}
                target="_blank"
                rel="noopener noreferrer"
              >
                Web Content Accessibility Guidelines (WCAG) 2.1 Level AA
              </a>{' '}
              for the web application.
            </p>
            <p style={s.para}>
              This statement applies to the ChainSolve web application at{' '}
              <strong>app.chainsolve.co.uk</strong> and the marketing/documentation site at{' '}
              <strong>chainsolve.co.uk</strong>.
            </p>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>What is accessible</h2>
            <ul style={s.list}>
              <li>All pages are navigable using a keyboard.</li>
              <li>All buttons and interactive controls have accessible names.</li>
              <li>
                Colour contrast meets WCAG 2.1 AA requirements for body text (4.5:1) and large text
                (3:1) in both light and dark themes.
              </li>
              <li>Pages respond correctly to browser text size increases up to 200%.</li>
              <li>Focus indicators are visible on all interactive elements.</li>
              <li>
                Error messages identify the affected field and describe how to correct the error.
              </li>
              <li>The application works without JavaScript-dependent animations if the user has enabled &ldquo;Prefers reduced motion&rdquo; in their operating system.</li>
            </ul>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>Known limitations</h2>
            <p style={s.para}>
              We are aware of the following limitations and are working to address them:
            </p>
            <ul style={s.list}>
              <li>
                <strong>Node graph canvas</strong> — The visual node graph (drag-and-drop block
                editor) relies on mouse or touch input for placing and connecting blocks. Keyboard
                users can use the Block Library to add blocks and the Inspector panel to configure
                them, but full graph construction via keyboard alone is limited. We provide a
                text-based results view for screen reader users.
              </li>
              <li>
                <strong>Port colour coding</strong> — Port type differentiation on blocks uses
                colour as the primary visual indicator. We are adding shape and icon secondary
                indicators to meet WCAG 1.4.1 (Colour alone).
              </li>
              <li>
                <strong>Complex tables in data blocks</strong> — Very large tables rendered in the
                canvas nodes may not have complete ARIA table markup. Exported data (CSV/XLSX) is
                fully accessible.
              </li>
            </ul>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>Technical information</h2>
            <p style={s.para}>
              ChainSolve is built with React 19 and React Flow. The core computation engine runs in
              a Web Worker via WebAssembly. Styles use CSS custom properties for theming.
            </p>
            <p style={s.para}>
              We test accessibility using:
            </p>
            <ul style={s.list}>
              <li>Playwright automated accessibility checks (axe-core)</li>
              <li>Manual keyboard-only navigation testing</li>
              <li>NVDA screen reader (Windows) and VoiceOver (macOS/iOS)</li>
              <li>Chrome DevTools Accessibility panel and Lighthouse</li>
            </ul>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>Feedback and contact</h2>
            <p style={s.para}>
              If you experience any accessibility barriers or have feedback on how we can improve,
              please contact us:
            </p>
            <ul style={s.list}>
              <li>
                Email:{' '}
                <a href={`mailto:${CONTACT.support}`} style={s.link}>
                  {CONTACT.support}
                </a>
              </li>
              <li>
                Subject line: <em>Accessibility feedback</em>
              </li>
            </ul>
            <p style={s.para}>
              We aim to respond to accessibility feedback within <strong>5 working days</strong>.
            </p>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>Enforcement</h2>
            <p style={s.para}>
              The Equality Act 2010 and the Public Sector Bodies Accessibility Regulations 2018
              require public sector websites to meet accessibility standards. While ChainSolve is a
              private sector product, we voluntarily align with these standards.
            </p>
            <p style={s.para}>
              If you are not satisfied with our response to your accessibility feedback, you can
              contact the{' '}
              <a
                href="https://www.equalityadvisoryservice.com/"
                style={s.link}
                target="_blank"
                rel="noopener noreferrer"
              >
                Equality Advisory and Support Service
              </a>{' '}
              (EASS).
            </p>
          </section>
        </article>

        <footer style={s.footer}>
          <Link to="/terms" style={s.footerLink}>
            Terms &amp; Conditions
          </Link>
          {' · '}
          <Link to="/privacy" style={s.footerLink}>
            Privacy Policy
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
    maxWidth: '720px',
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
