/**
 * PrivacyPage — L1-2: Static Privacy Policy page.
 *
 * Accessible at /privacy. Cross-linked from TermsPage section 7
 * and from the site-wide LegalFooter.
 */

import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BRAND, CONTACT, COMPANY } from '../lib/brand'
import { LegalFooter } from '../components/ui/LegalFooter'
import { usePageMeta, useHreflang } from '../lib/seo'

export default function PrivacyPage() {
  const { t } = useTranslation()
  usePageMeta(t('seo.privacy.title'), t('seo.privacy.description'))
  useHreflang('/privacy')
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
          <h1 style={s.title}>{t('privacy.title')}</h1>
          <p style={s.meta}>{t('terms.effectiveDate', { date: effectiveDate })}</p>

          <section style={s.section}>
            <h2 style={s.heading}>1. {t('privacy.s1Title')}</h2>
            <p style={s.para}>
              {COMPANY.name} (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) operates the
              ChainSolve service. This Privacy Policy explains what data we collect, why we collect
              it, and how we protect it. By using ChainSolve you consent to the practices described
              here.
            </p>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>2. {t('privacy.s2Title')}</h2>
            <p style={s.para}>We collect only data necessary to provide and improve the Service:</p>
            <ul style={s.list}>
              <li>
                <strong>Account data</strong> &mdash; email address, display name, avatar
                (optional), and authentication credentials managed by our identity provider
                (Supabase Auth).
              </li>
              <li>
                <strong>Project data</strong> &mdash; computation graphs, node configurations, and
                variable values you create within ChainSolve. Stored in cloud storage linked to your
                account.
              </li>
              <li>
                <strong>Usage metadata</strong> &mdash; timestamps, feature usage counters (e.g.
                ChainSolve AI token counts), and anonymised performance metrics. We do not store raw
                AI prompts or responses.
              </li>
              <li>
                <strong>Payment data</strong> &mdash; processed by Stripe. We do not store card
                numbers or bank details. We retain only a Stripe customer ID and subscription
                status.
              </li>
              <li>
                <strong>Technical data</strong> &mdash; IP address, user agent, and browser type
                recorded in security logs and the terms acceptance audit log.
              </li>
            </ul>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>3. {t('privacy.s3Title')}</h2>
            <p style={s.para}>We use your data to:</p>
            <ul style={s.list}>
              <li>
                Provide and operate the Service (account management, project storage, billing).
              </li>
              <li>
                Detect and prevent abuse, fraud, and security incidents (rate limiting, CSP
                reporting).
              </li>
              <li>
                Improve the Service through anonymised, aggregated usage analytics. No personally
                identifiable information is included in analytics.
              </li>
              <li>
                Communicate with you about your account, billing, and (if opted in) product updates.
              </li>
            </ul>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>4. {t('privacy.s4Title')}</h2>
            <p style={s.para}>
              We share data with third parties only as necessary to operate the Service:
            </p>
            <ul style={s.list}>
              <li>
                <strong>Supabase</strong> &mdash; database hosting, authentication, and file
                storage.
              </li>
              <li>
                <strong>Stripe</strong> &mdash; payment processing and subscription management.
              </li>
              <li>
                <strong>Cloudflare</strong> &mdash; hosting, CDN, and DDoS protection.
              </li>
              <li>
                <strong>OpenAI</strong> &mdash; ChainSolve AI requests (opt-in feature only).
                Requests are sent with <code>store:&nbsp;false</code> so OpenAI does not retain your
                data. See our{' '}
                <a href="/docs?section=ai-assistant" style={s.link}>
                  AI Privacy documentation
                </a>{' '}
                for details.
              </li>
              <li>
                <strong>Resend</strong> &mdash; transactional email delivery (via SMTP).
              </li>
            </ul>
            <p style={s.para}>
              We do not sell, rent, or trade your personal data to any third party for marketing or
              advertising purposes.
            </p>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>5. {t('privacy.s5Title')}</h2>
            <ul style={s.list}>
              <li>All data is transmitted over HTTPS (TLS 1.2+).</li>
              <li>
                Database access is controlled by Row Level Security (RLS) policies. Each user can
                only access their own data.
              </li>
              <li>
                Storage buckets are private with path-based ACL (files are scoped to the owning user
                ID).
              </li>
              <li>
                Authentication tokens are short-lived JWTs with automatic refresh. Sessions can be
                revoked.
              </li>
              <li>Payment data is handled entirely by Stripe and never touches our servers.</li>
            </ul>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>6. {t('privacy.s6Title')}</h2>
            <p style={s.para}>We retain your data as follows:</p>
            <ul style={s.list}>
              <li>
                <strong>Account and project data</strong> &mdash; retained for the lifetime of your
                account. Deleted within 30 days of account deletion.
              </li>
              <li>
                <strong>Audit logs</strong> (terms acceptance, security events) &mdash; retained
                indefinitely unless an enterprise data retention policy applies.
              </li>
              <li>
                <strong>Usage metadata</strong> &mdash; retained indefinitely in anonymised,
                aggregated form.
              </li>
              <li>
                <strong>Payment records</strong> &mdash; retained as required by financial
                regulations (typically 7 years).
              </li>
            </ul>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>7. {t('privacy.s7Title')}</h2>
            <p style={s.para}>You have the right to:</p>
            <ul style={s.list}>
              <li>
                <strong>Access</strong> your personal data (available via account settings and
                project export).
              </li>
              <li>
                <strong>Correct</strong> inaccurate data (via profile settings).
              </li>
              <li>
                <strong>Delete</strong> your account and associated data (contact{' '}
                <a href={`mailto:${CONTACT.support}`} style={s.link}>
                  {CONTACT.support}
                </a>
                ).
              </li>
              <li>
                <strong>Export</strong> your project data in portable formats (JSON, PDF, XLSX).
              </li>
              <li>
                <strong>Withdraw consent</strong> for marketing communications at any time (via
                profile settings).
              </li>
            </ul>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>8. {t('privacy.s8Title')}</h2>
            <p style={s.para}>
              ChainSolve is not intended for children under 16. We do not knowingly collect data
              from children. If you believe a child has provided us with personal data, contact us
              and we will delete it.
            </p>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>9. {t('privacy.s9Title')}</h2>
            <p style={s.para}>
              We may update this Privacy Policy from time to time. Changes will be reflected by an
              updated effective date. For material changes, we will notify users via the in-app
              terms acceptance gate. Continued use of the Service after changes constitutes
              acceptance of the updated policy.
            </p>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>10. {t('privacy.s10Title')}</h2>
            <p style={s.para}>
              If you have questions about this Privacy Policy or wish to exercise your data rights,
              contact us at{' '}
              <a href={`mailto:${CONTACT.support}`} style={s.link}>
                {CONTACT.support}
              </a>{' '}
              or{' '}
              <a href={`mailto:${CONTACT.info}`} style={s.link}>
                {CONTACT.info}
              </a>
              .
            </p>
            <p style={s.para}>
              {COMPANY.name}, registered in {COMPANY.jurisdiction}, Company No.{' '}
              {COMPANY.companyNumber}.
            </p>
          </section>
        </article>

        <footer style={s.footer}>
          <Link to="/terms" style={s.footerLink}>
            {t('privacy.viewTerms')}
          </Link>
        </footer>
      </div>
      <LegalFooter />
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────
// Shared with TermsPage for visual consistency.

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
  } as React.CSSProperties,
  footerLink: {
    color: 'var(--primary)',
    fontSize: '0.9rem',
    textDecoration: 'underline',
  } as React.CSSProperties,
}
