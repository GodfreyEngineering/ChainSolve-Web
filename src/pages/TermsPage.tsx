/**
 * TermsPage — Static Terms & Conditions page.
 *
 * Accessible at /terms. Linked from the signup form (Login.tsx)
 * and the ToS acceptance gate (AuthGate.tsx).
 */

import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BRAND, CONTACT } from '../lib/brand'
import { CURRENT_TERMS_VERSION } from '../lib/termsVersion'

export default function TermsPage() {
  const { t } = useTranslation()
  const effectiveDate = '1 March 2025'

  return (
    <div style={s.page}>
      <div style={s.container}>
        <header style={s.header}>
          <Link to="/" style={s.logoLink}>
            <img src={BRAND.logoWideText} alt={t('app.name')} style={s.logo} />
          </Link>
        </header>

        <article style={s.article}>
          <h1 style={s.title}>{t('terms.title')}</h1>
          <p style={s.meta}>
            {t('terms.version', { version: CURRENT_TERMS_VERSION })} &middot;{' '}
            {t('terms.effectiveDate', { date: effectiveDate })}
          </p>

          <section style={s.section}>
            <h2 style={s.heading}>1. Acceptance of Terms</h2>
            <p style={s.para}>
              By creating an account or using ChainSolve (&ldquo;the Service&rdquo;), you agree to
              be bound by these Terms &amp; Conditions. If you do not agree, do not use the Service.
            </p>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>2. Description of Service</h2>
            <p style={s.para}>
              ChainSolve is a scientific node-graph calculator that allows users to build, evaluate,
              and share computational graphs. The Service includes a web application, a
              WebAssembly-based computation engine, cloud storage for projects, and an Explore
              marketplace for templates, block packs, and themes.
            </p>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>3. Accounts</h2>
            <p style={s.para}>
              You must provide accurate information when creating an account. You are responsible
              for maintaining the security of your account credentials. You must notify us
              immediately of any unauthorized use of your account.
            </p>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>4. Acceptable Use</h2>
            <p style={s.para}>You agree not to:</p>
            <ul style={s.list}>
              <li>Use the Service for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to any part of the Service</li>
              <li>
                Interfere with or disrupt the Service or servers or networks connected to the
                Service
              </li>
              <li>Upload malicious content, viruses, or harmful code</li>
              <li>Use the Service to infringe upon the intellectual property rights of others</li>
              <li>
                Scrape, crawl, or use automated means to access the Service without permission
              </li>
            </ul>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>5. Intellectual Property</h2>
            <p style={s.para}>
              The Service, including its software, design, and content, is owned by ChainSolve and
              protected by intellectual property laws. You retain ownership of any content you
              create using the Service (your projects, templates, and data). By publishing content
              on the Explore marketplace, you grant ChainSolve a non-exclusive licence to host and
              distribute that content.
            </p>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>6. Subscriptions and Payments</h2>
            <p style={s.para}>
              Some features require a paid subscription. Subscriptions are billed in advance on a
              monthly or annual basis. You may cancel at any time; access continues until the end of
              the current billing period. Refunds are not provided for partial billing periods.
              Prices may change with 30 days&rsquo; notice.
            </p>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>7. Data and Privacy</h2>
            <p style={s.para}>
              Your use of the Service is also governed by our Privacy Policy. We collect only the
              data necessary to provide the Service. Your project data is stored securely and is not
              shared with third parties except as required to operate the Service (e.g. cloud
              hosting providers). You may export or delete your data at any time.
            </p>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>8. Availability and Warranties</h2>
            <p style={s.para}>
              The Service is provided &ldquo;as is&rdquo; without warranties of any kind, whether
              express or implied. We do not guarantee that the Service will be uninterrupted,
              error-free, or that the results obtained from use of the Service will be accurate. We
              are not liable for any loss or damage arising from your use of the Service.
            </p>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>9. Limitation of Liability</h2>
            <p style={s.para}>
              To the fullest extent permitted by law, ChainSolve shall not be liable for any
              indirect, incidental, special, consequential, or punitive damages, or any loss of
              profits or revenue, whether incurred directly or indirectly, arising from your use of
              the Service.
            </p>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>10. Termination</h2>
            <p style={s.para}>
              We may suspend or terminate your access to the Service at any time for violation of
              these Terms. Upon termination, your right to use the Service ceases immediately. You
              may request an export of your data within 30 days of termination.
            </p>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>11. Changes to Terms</h2>
            <p style={s.para}>
              We may update these Terms from time to time. When we do, we will update the version
              number and effective date. Continued use of the Service after changes constitutes
              acceptance of the new Terms. For material changes, we will notify you via the in-app
              acceptance gate.
            </p>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>12. Governing Law</h2>
            <p style={s.para}>
              These Terms are governed by the laws of England and Wales. Any disputes shall be
              resolved in the courts of England and Wales.
            </p>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>13. Contact</h2>
            <p style={s.para}>
              If you have questions about these Terms, contact us at{' '}
              <a href={`mailto:${CONTACT.support}`} style={s.link}>
                {CONTACT.support}
              </a>
              .
            </p>
          </section>
        </article>

        <footer style={s.footer}>
          <Link to="/login" style={s.footerLink}>
            {t('terms.backToSignIn')}
          </Link>
        </footer>
      </div>
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
    background: 'var(--card-bg)',
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
  } as React.CSSProperties,
  footerLink: {
    color: 'var(--primary)',
    fontSize: '0.9rem',
    textDecoration: 'underline',
  } as React.CSSProperties,
}
