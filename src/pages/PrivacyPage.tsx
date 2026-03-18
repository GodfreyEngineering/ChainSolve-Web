/**
 * PrivacyPage — Legally complete Privacy Policy page (16.21–16.33).
 *
 * Compliant with: UK GDPR (Data Protection Act 2018), EU GDPR (2016/679),
 * ePrivacy Directive, COPPA.
 *
 * Accessible at /privacy. Cross-linked from TermsPage section 7
 * and from the site-wide LegalFooter.
 */

import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BRAND, CONTACT, COMPANY } from '../lib/brand'
import { LegalFooter } from '../components/ui/LegalFooter'
import { usePageMeta, useHreflang } from '../lib/seo'
import { CURRENT_PRIVACY_VERSION } from '../lib/termsVersion'
import { LegalLanguageNotice } from '../components/ui/LegalLanguageNotice'
import { LegalPdfDownload } from '../components/ui/LegalPdfDownload'

export default function PrivacyPage() {
  const { t } = useTranslation()
  usePageMeta(t('seo.privacy.title'), t('seo.privacy.description'))
  useHreflang('/privacy')
  const lastUpdated = '17 March 2026'

  return (
    <div style={s.page}>
      <div style={s.container}>
        <header style={s.header}>
          <Link to="/" style={s.logoLink}>
            <img src={BRAND.logoWideText} alt={t('app.name')} style={s.logo} />
          </Link>
        </header>

        <LegalLanguageNotice canonicalUrl="/privacy" />

        <article style={s.article}>
          <div style={s.titleRow}>
            <h1 style={s.title}>{t('privacy.title')}</h1>
            <LegalPdfDownload filename="ChainSolve-Privacy-Policy" />
          </div>
          <p style={s.meta}>
            {t('terms.version', { version: CURRENT_PRIVACY_VERSION })} &middot;{' '}
            {t('terms.effectiveDate', { date: lastUpdated })}
          </p>

          {/* ── 1. Data Controller ──────────────────────────────────────── */}
          <section style={s.section}>
            <h2 style={s.heading}>1. {t('privacy.s1Title')}</h2>
            <p style={s.para}>
              The data controller for personal data processed through the ChainSolve service is:
            </p>
            <p style={s.para}>
              <strong>{COMPANY.name}</strong>
              <br />
              Registered in {COMPANY.jurisdiction}
              <br />
              Company No. {COMPANY.companyNumber}
              <br />
              Privacy contact:{' '}
              <a href={`mailto:${CONTACT.support}`} style={s.link}>
                {CONTACT.support}
              </a>
            </p>
            <p style={s.para}>
              This Privacy Policy explains what personal data we collect, why we collect it, the
              legal basis for processing it, and your rights under UK GDPR (Data Protection Act
              2018), EU GDPR (Regulation 2016/679), and ePrivacy Directive.
            </p>
          </section>

          {/* ── 2. Data We Collect ──────────────────────────────────────── */}
          <section style={s.section}>
            <h2 style={s.heading}>2. {t('privacy.s2Title')}</h2>
            <p style={s.para}>We collect only data necessary to provide and improve the Service:</p>
            <ul style={s.list}>
              <li>
                <strong>Account data</strong> &mdash; email address, display name, avatar
                (optional), and hashed authentication credentials managed by Supabase Auth. Provided
                at registration.
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
                numbers or bank details. We retain only a Stripe customer ID, subscription status,
                and invoices.
              </li>
              <li>
                <strong>Technical / security data</strong> &mdash; IP address, user agent, browser
                type, and session timestamps recorded in security logs and the terms-acceptance
                audit log.
              </li>
              <li>
                <strong>Communications data</strong> &mdash; content of support emails or contact
                form submissions you send to us.
              </li>
            </ul>
          </section>

          {/* ── 3. Purposes of Processing ───────────────────────────────── */}
          <section style={s.section}>
            <h2 style={s.heading}>3. {t('privacy.s3Title')}</h2>
            <p style={s.para}>We use your data for the following purposes:</p>
            <ul style={s.list}>
              <li>
                Providing and operating the Service (account management, project storage, billing)
              </li>
              <li>Authenticating users and managing sessions</li>
              <li>Processing payments and managing subscriptions</li>
              <li>
                Sending transactional emails (password reset, billing receipts, important account
                notices)
              </li>
              <li>Sending marketing emails (only with your explicit consent)</li>
              <li>
                Detecting and preventing abuse, fraud, and security incidents (rate limiting, CSP
                reporting, security logging)
              </li>
              <li>
                Improving the Service through anonymised, aggregated analytics. No personally
                identifiable information is included in analytics data.
              </li>
              <li>Responding to support requests and communications</li>
              <li>
                Complying with legal obligations (financial record-keeping, responding to lawful
                requests)
              </li>
            </ul>
          </section>

          {/* ── 4. Legal Basis for Processing (GDPR Art. 6) ────────────── */}
          <section style={s.section}>
            <h2 style={s.heading}>4. Legal Basis for Processing</h2>
            <p style={s.para}>Under UK GDPR Art. 6, we rely on the following legal bases:</p>
            <ul style={s.list}>
              <li>
                <strong>Contract performance (Art. 6(1)(b))</strong> &mdash; processing of account
                data, project data, authentication, service delivery, and transactional emails is
                necessary to perform our contract with you (the Terms &amp; Conditions you accepted
                at signup).
              </li>
              <li>
                <strong>Legal obligation (Art. 6(1)(c))</strong> &mdash; retention of financial
                records for 7 years as required by HMRC; responding to lawful requests from
                regulators and courts.
              </li>
              <li>
                <strong>Legitimate interests (Art. 6(1)(f))</strong> &mdash; security logging, fraud
                prevention, rate limiting, and aggregated analytics. Our legitimate interest is
                operating a secure and reliable service. These interests do not override your rights
                where you object.
              </li>
              <li>
                <strong>Consent (Art. 6(1)(a))</strong> &mdash; sending marketing emails and loading
                non-essential analytics scripts. You may withdraw consent at any time via profile
                settings or by emailing us; withdrawal does not affect the lawfulness of prior
                processing.
              </li>
            </ul>
          </section>

          {/* ── 5. Sub-Processors and Data Sharing ──────────────────────── */}
          <section style={s.section}>
            <h2 style={s.heading}>5. {t('privacy.s4Title')}</h2>
            <p style={s.para}>
              We share personal data with the following sub-processors only as necessary to operate
              the Service:
            </p>
            <ul style={s.list}>
              <li>
                <strong>Supabase</strong> &mdash; database hosting, authentication, and file
                storage. Data stored in the EU (AWS eu-west-1 or eu-central-1). Supabase Inc. is a
                US company; transfers are covered by Standard Contractual Clauses (SCCs) and the UK
                International Data Transfer Agreement (IDTA).
              </li>
              <li>
                <strong>Stripe</strong> &mdash; payment processing and subscription management.
                Stripe, Inc. is a US company; transfers covered by SCCs / UK IDTA. Stripe
                automatically applies a Data Processing Agreement to all accounts.
              </li>
              <li>
                <strong>Cloudflare</strong> &mdash; hosting, CDN, and DDoS protection. Cloudflare
                processes data globally including in the UK and EU. Cloudflare complies with UK GDPR
                under SCCs.
              </li>
              <li>
                <strong>OpenAI</strong> &mdash; ChainSolve AI requests (opt-in feature only).
                Requests are sent with <code>store:&nbsp;false</code> so OpenAI does not retain your
                data for training. OpenAI is a US company; transfers covered by SCCs / UK IDTA. See
                our{' '}
                <a href="/docs?section=ai-assistant" style={s.link}>
                  AI Privacy documentation
                </a>{' '}
                for details.
              </li>
              <li>
                <strong>Resend</strong> &mdash; transactional email delivery. Resend Inc. is a US
                company; transfers covered by SCCs / UK IDTA.
              </li>
            </ul>
            <p style={s.para}>
              We do not sell, rent, or trade your personal data to any third party for marketing or
              advertising purposes.
            </p>
          </section>

          {/* ── 6. International Data Transfers ─────────────────────────── */}
          <section style={s.section}>
            <h2 style={s.heading}>6. International Data Transfers</h2>
            <p style={s.para}>
              Some sub-processors are based outside the UK and EU. Where personal data is
              transferred outside the UK, we ensure an adequate level of protection using one or
              more of the following mechanisms:
            </p>
            <ul style={s.list}>
              <li>
                <strong>UK adequacy regulations</strong> &mdash; transfers to countries the UK
                Secretary of State has designated as providing adequate protection.
              </li>
              <li>
                <strong>UK International Data Transfer Agreement (IDTA)</strong> &mdash; the UK
                equivalent of EU Standard Contractual Clauses, used for transfers to the US and
                other non-adequate countries.
              </li>
              <li>
                <strong>EU Standard Contractual Clauses (SCCs)</strong> &mdash; used where the
                sub-processor is headquartered in a non-adequate country and the transfer originates
                from the EEA.
              </li>
            </ul>
            <p style={s.para}>
              You may request a copy of the specific transfer mechanism used for any sub-processor
              by contacting{' '}
              <a href={`mailto:${CONTACT.support}`} style={s.link}>
                {CONTACT.support}
              </a>
              .
            </p>
          </section>

          {/* ── 7. Security ─────────────────────────────────────────────── */}
          <section style={s.section}>
            <h2 style={s.heading}>7. {t('privacy.s5Title')}</h2>
            <ul style={s.list}>
              <li>All data is transmitted over HTTPS (TLS 1.2+).</li>
              <li>
                Database access is controlled by Row Level Security (RLS) policies. Each user can
                only access their own data.
              </li>
              <li>
                Storage buckets are private with path-based access control (files are scoped to the
                owning user ID).
              </li>
              <li>
                Authentication tokens are short-lived JWTs with automatic refresh. Sessions can be
                revoked individually or globally.
              </li>
              <li>Payment data is handled entirely by Stripe and never touches our servers.</li>
              <li>
                We implement Content Security Policy (CSP), HSTS, and other security headers to
                protect against common web vulnerabilities.
              </li>
            </ul>
          </section>

          {/* ── 8. Retention Periods ────────────────────────────────────── */}
          <section style={s.section}>
            <h2 style={s.heading}>8. {t('privacy.s6Title')}</h2>
            <p style={s.para}>We retain your data for the following periods:</p>
            <ul style={s.list}>
              <li>
                <strong>Account data</strong> &mdash; retained while your account is active. Upon
                account deletion, user records are removed from Supabase Auth immediately and all
                associated data is purged within 30 days.
              </li>
              <li>
                <strong>Project data</strong> (graphs, files, configurations) &mdash; retained while
                your account is active. Deleted within 30 days of account deletion request. After
                deletion, projects remain accessible in read-only mode for 30 days to allow data
                export.
              </li>
              <li>
                <strong>Security and audit logs</strong> (terms acceptance, login events) &mdash;
                retained for 90 days, then deleted, except where required for a specific
                investigation.
              </li>
              <li>
                <strong>Financial and payment records</strong> &mdash; retained for 7 years as
                required by HMRC and the Companies Act 2006.
              </li>
              <li>
                <strong>Usage metadata</strong> &mdash; retained indefinitely in anonymised,
                aggregated form (no individual identification possible).
              </li>
              <li>
                <strong>Communications</strong> (support emails) &mdash; retained for 3 years, then
                deleted unless the matter is unresolved or legally required.
              </li>
            </ul>
          </section>

          {/* ── 9. Your Rights (GDPR Art. 15–21) ───────────────────────── */}
          <section style={s.section}>
            <h2 style={s.heading}>9. {t('privacy.s7Title')}</h2>
            <p style={s.para}>
              Under UK GDPR and EU GDPR you have the following rights. We will respond to all
              requests within 30 days. To exercise any right, contact{' '}
              <a href={`mailto:${CONTACT.support}`} style={s.link}>
                {CONTACT.support}
              </a>
              .
            </p>
            <ul style={s.list}>
              <li>
                <strong>Right of access (Art. 15)</strong> &mdash; obtain a copy of the personal
                data we hold about you and information about how it is processed. Available via
                account settings → &ldquo;Download my data&rdquo;.
              </li>
              <li>
                <strong>Right to rectification (Art. 16)</strong> &mdash; correct inaccurate
                personal data. Available via profile settings or by contacting us.
              </li>
              <li>
                <strong>Right to erasure / &ldquo;right to be forgotten&rdquo; (Art. 17)</strong>{' '}
                &mdash; request deletion of your personal data where it is no longer necessary,
                where you withdraw consent, or where we have no lawful basis for continued
                processing. Available via account settings → &ldquo;Delete my account&rdquo; or by
                contacting us.
              </li>
              <li>
                <strong>Right to restriction of processing (Art. 18)</strong> &mdash; request that
                we restrict processing of your personal data in certain circumstances (e.g. while
                you contest its accuracy). Contact us to exercise this right.
              </li>
              <li>
                <strong>Right to data portability (Art. 20)</strong> &mdash; receive your personal
                data in a structured, commonly used, machine-readable format (JSON). Available via
                account settings → &ldquo;Download my data&rdquo;. Applies to data processed by
                automated means on the basis of contract or consent.
              </li>
              <li>
                <strong>Right to object (Art. 21)</strong> &mdash; object to processing based on
                legitimate interests. We will cease processing unless we can demonstrate compelling
                legitimate grounds that override your interests. You may always object to direct
                marketing processing (marketing emails) — this is an absolute right.
              </li>
              <li>
                <strong>Right to withdraw consent (Art. 7(3))</strong> &mdash; where processing is
                based on consent (marketing emails, non-essential analytics), you may withdraw at
                any time via profile settings. Withdrawal does not affect the lawfulness of
                processing before withdrawal.
              </li>
              <li>
                <strong>Right to lodge a complaint</strong> &mdash; you have the right to lodge a
                complaint with the Information Commissioner&rsquo;s Office (ICO), the UK supervisory
                authority for data protection:{' '}
                <a
                  href="https://ico.org.uk/make-a-complaint/"
                  style={s.link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ico.org.uk/make-a-complaint
                </a>
                . If you are in the EU, you may also lodge a complaint with your local supervisory
                authority.
              </li>
            </ul>
            <p style={s.para}>
              We aim to respond to all data subject requests within <strong>30 days</strong>. If
              your request is complex or numerous, we may extend this by a further two months and
              will notify you.
            </p>
          </section>

          {/* ── 10. Account Deletion ────────────────────────────────────── */}
          <section style={s.section}>
            <h2 style={s.heading}>10. Account Deletion</h2>
            <p style={s.para}>
              You can delete your account at any time via{' '}
              <strong>Settings → Account → Delete account</strong>. Deletion triggers:
            </p>
            <ul style={s.list}>
              <li>Immediate revocation of all active authentication sessions.</li>
              <li>Immediate cancellation of any active paid subscription via Stripe.</li>
              <li>
                Your projects and files remain accessible in read-only mode for 30 days so you can
                export them.
              </li>
              <li>
                All personal data (account record, projects, files, preferences) is permanently
                deleted within 30 days of the request.
              </li>
              <li>
                Financial records are retained for 7 years as required by HMRC, but are not
                accessible to you or any service after account deletion.
              </li>
              <li>A deletion confirmation email is sent to your registered address.</li>
            </ul>
          </section>

          {/* ── 11. Children's Data ─────────────────────────────────────── */}
          <section style={s.section}>
            <h2 style={s.heading}>11. {t('privacy.s8Title')}</h2>
            <p style={s.para}>
              ChainSolve is not directed at children under 13 years of age (or under 16 in EU member
              states that have raised the age of digital consent under GDPR Art. 8). We do not
              knowingly collect personal data from children. If you believe a child has registered
              or provided personal data, contact{' '}
              <a href={`mailto:${CONTACT.support}`} style={s.link}>
                {CONTACT.support}
              </a>{' '}
              immediately and we will delete the data without delay.
            </p>
          </section>

          {/* ── 12. Cookies and Local Storage ───────────────────────────── */}
          <section style={s.section}>
            <h2 style={s.heading}>12. Cookies and Local Storage</h2>
            <p style={s.para}>
              We use cookies, localStorage, and IndexedDB to operate the Service. A full list of
              every storage item — name, provider, purpose, category, and expiry — is published in
              our{' '}
              <Link to="/cookies" style={s.link}>
                Cookie Policy
              </Link>
              . Strictly necessary items (authentication tokens, session IDs) cannot be disabled.
              Non-essential items (analytics) are loaded only with your consent.
            </p>
          </section>

          {/* ── 13. Policy Updates ──────────────────────────────────────── */}
          <section style={s.section}>
            <h2 style={s.heading}>13. {t('privacy.s9Title')}</h2>
            <p style={s.para}>
              We may update this Privacy Policy from time to time. The version number and
              &ldquo;last updated&rdquo; date at the top of this page always reflect the current
              version. For material changes (changes to data categories collected, purposes,
              sub-processors, or your rights), we will notify you by email at least 30 days before
              the change takes effect. Continued use of the Service after the effective date
              constitutes acceptance of the updated policy.
            </p>
          </section>

          {/* ── 14. Contact and Supervisory Authority ───────────────────── */}
          <section style={s.section}>
            <h2 style={s.heading}>14. {t('privacy.s10Title')}</h2>
            <p style={s.para}>
              For questions about this Privacy Policy, to exercise your data rights, or to submit a
              Subject Access Request, contact us at{' '}
              <a href={`mailto:${CONTACT.support}`} style={s.link}>
                {CONTACT.support}
              </a>
              . We will respond within <strong>30 days</strong>.
            </p>
            <p style={s.para}>
              {COMPANY.name}, registered in {COMPANY.jurisdiction}, Company No.{' '}
              {COMPANY.companyNumber}.
            </p>
            <p style={s.para}>
              You also have the right to lodge a complaint with the UK&rsquo;s supervisory authority
              for data protection, the Information Commissioner&rsquo;s Office (ICO), at{' '}
              <a href="https://ico.org.uk" style={s.link} target="_blank" rel="noopener noreferrer">
                ico.org.uk
              </a>
              .
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
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    flexWrap: 'wrap' as const,
    marginBottom: '0.25rem',
  } as React.CSSProperties,
  title: {
    margin: 0,
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
