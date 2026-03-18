/**
 * LicencesPage — 16.73: Third-Party Licence Notices.
 *
 * Accessible at /licences.
 * Points to the machine-readable THIRD_PARTY_LICENCES.md at the repo root
 * and summarises licence obligations.
 */

import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BRAND, CONTACT } from '../lib/brand'
import { LegalFooter } from '../components/ui/LegalFooter'
import { usePageMeta, useHreflang } from '../lib/seo'

export default function LicencesPage() {
  const { t } = useTranslation()
  usePageMeta(
    'Third-Party Licences – ChainSolve',
    'Open-source software licence notices for ChainSolve.',
  )
  useHreflang('/licences')

  return (
    <div style={s.page}>
      <div style={s.container}>
        <header style={s.header}>
          <Link to="/" style={s.logoLink}>
            <img src={BRAND.logoWideText} alt={t('app.name')} style={s.logo} />
          </Link>
        </header>

        <article style={s.article}>
          <h1 style={s.title}>Third-Party Licence Notices</h1>

          <section style={s.section}>
            <p style={s.para}>
              ChainSolve is built on open-source software. We are grateful to the communities that
              create and maintain these libraries.
            </p>
            <p style={s.para}>
              ChainSolve itself is proprietary software &copy; Godfrey Engineering Ltd. The
              open-source components it depends on retain their respective licences.
            </p>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>Licence Summary</h2>
            <p style={s.para}>
              ChainSolve uses only open-source components with licences compatible with commercial
              software distribution:
            </p>
            <ul style={s.list}>
              <li>
                <strong>MIT Licence</strong> — React, React Flow, Zustand, Vite, and many others.
                Permits use in any software. No copyleft.
              </li>
              <li>
                <strong>Apache 2.0</strong> — Rust standard library crates. Permits commercial use
                with patent grant.
              </li>
              <li>
                <strong>ISC Licence</strong> — Lucide React (icons). Equivalent to MIT; no
                attribution required.
              </li>
              <li>
                <strong>SIL Open Font Licence 1.1</strong> — Montserrat and JetBrains Mono fonts.
                Permits use in web applications.
              </li>
              <li>
                <strong>BSD 2-Clause / BSD 3-Clause</strong> — Various Rust crates. Permissive;
                requires copyright notice preservation.
              </li>
              <li>
                <strong>Mozilla Public Licence 2.0 (MPL-2.0)</strong> — Used by some Rust crates.
                File-level copyleft; does not affect ChainSolve's proprietary code.
              </li>
            </ul>
            <p style={s.para}>
              No GPL, AGPL, LGPL, or SSPL components are included. Our CI pipeline enforces this via{' '}
              <code>cargo deny</code> and <code>license-checker</code>.
            </p>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>Full Licence Text</h2>
            <p style={s.para}>
              A complete machine-readable list of all 700+ open-source dependencies and their SPDX
              licence identifiers is available in our GitHub repository:
            </p>
            <ul style={s.list}>
              <li>
                <strong>Rust/WASM engine dependencies</strong>:{' '}
                <code>legal/rust-dependency-licences.md</code>
              </li>
              <li>
                <strong>JavaScript/TypeScript dependencies</strong>:{' '}
                <code>legal/frontend-dependency-licences.md</code>
              </li>
              <li>
                <strong>Combined (all dependencies)</strong>: <code>THIRD_PARTY_LICENCES.md</code>
              </li>
            </ul>
            <p style={s.para}>
              Font licences are documented in <code>legal/font-licences.md</code>. Icon licences are
              documented in <code>legal/asset-licences.md</code>.
            </p>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>Requesting Licence Copies</h2>
            <p style={s.para}>
              If you require a copy of any open-source licence text for compliance purposes (e.g.
              distribution in an enterprise environment), contact us at{' '}
              <a href={`mailto:${CONTACT.support}`} style={s.link}>
                {CONTACT.support}
              </a>{' '}
              and we will provide the relevant texts.
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
    margin: '0 0 2rem',
    fontSize: '1.75rem',
    fontWeight: 700,
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
