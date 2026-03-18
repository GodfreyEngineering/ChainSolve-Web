/**
 * TermsPage — Static Terms & Conditions page.
 *
 * Accessible at /terms. Linked from the signup form (Login.tsx)
 * and the ToS acceptance gate (AuthGate.tsx).
 */

import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BRAND, CONTACT } from '../lib/brand'
import { LegalFooter } from '../components/ui/LegalFooter'
import { usePageMeta, useHreflang } from '../lib/seo'
import { CURRENT_TERMS_VERSION } from '../lib/termsVersion'

export default function TermsPage() {
  const { t } = useTranslation()
  usePageMeta(t('seo.terms.title'), t('seo.terms.description'))
  useHreflang('/terms')
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
            <h2 style={s.heading}>1. Definitions</h2>
            <p style={s.para}>In these Terms, the following terms have the meanings set out below:</p>
            <ul style={s.list}>
              <li>
                <strong>"Service"</strong> means the ChainSolve web application, computation engine,
                cloud storage, API, and any associated software and services provided by Godfrey
                Engineering Ltd, accessible at chainsolve.co.uk and related domains.
              </li>
              <li>
                <strong>"User"</strong> or <strong>"you"</strong> means any individual who accesses
                or uses the Service, whether registered or not.
              </li>
              <li>
                <strong>"Account"</strong> means the registered user account created by providing an
                email address and password (or third-party OAuth) through which a User accesses the
                Service.
              </li>
              <li>
                <strong>"Content"</strong> means any data, files, text, graphs, or other material
                that a User uploads, creates, or stores through the Service.
              </li>
              <li>
                <strong>"Calculation Graph"</strong> means a directed acyclic graph of computational
                blocks connected by edges that the Service evaluates to produce numerical, symbolic,
                or data output.
              </li>
              <li>
                <strong>"We", "us", "our"</strong> means Godfrey Engineering Ltd, registered in
                England and Wales (Company Number 16845827).
              </li>
            </ul>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>2. Acceptance of Terms</h2>
            <p style={s.para}>
              By creating an Account or using the Service, you agree to be bound by these Terms. If
              you do not agree, you must not use the Service. These Terms constitute a legally
              binding agreement between you and Godfrey Engineering Ltd.
            </p>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>3. Description of Service</h2>
            <p style={s.para}>
              ChainSolve is a scientific node-graph calculator that allows users to build, evaluate,
              and share computational graphs. The Service includes a web application, a
              WebAssembly-based computation engine, cloud storage for projects, and an Explore
              marketplace for templates, block packs, and themes.
            </p>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>4. Accounts and Eligibility</h2>
            <p style={s.para}>
              You must be at least 13 years of age to use the Service (or at least 16 years of age
              if you are in the European Union). If you are under 18, you confirm that you have your
              parent or guardian&apos;s permission to use the Service. We do not knowingly collect
              personal data from children under 13 (or 16 in the EU). If we discover that a child
              under the applicable age has created an Account, we will delete that Account and all
              associated data immediately.
            </p>
            <p style={s.para}>
              You must provide accurate, current, and complete information when creating an Account.
              You are responsible for maintaining the security of your Account credentials. You must
              notify us immediately at{' '}
              <a href={`mailto:${CONTACT.support}`} style={s.link}>
                {CONTACT.support}
              </a>{' '}
              of any unauthorised use of your Account.
            </p>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>5. Acceptable Use</h2>
            <p style={s.para}>You agree not to:</p>
            <ul style={s.list}>
              <li>Use the Service for any unlawful purpose or in violation of applicable laws or regulations</li>
              <li>Attempt to gain unauthorised access to any part of the Service, its servers, or connected networks</li>
              <li>Interfere with or disrupt the Service or the servers and networks connected to it</li>
              <li>Upload malicious content, viruses, trojans, worms, or harmful code of any kind</li>
              <li>Use the Service to infringe upon the intellectual property rights of others</li>
              <li>Scrape, crawl, or use automated means to access the Service without our express written permission</li>
              <li>
                Reverse engineer, decompile, disassemble, or attempt to extract source code from the
                computation engine or any proprietary components of the Service (except to the extent
                permitted by applicable law that cannot be excluded by contract)
              </li>
              <li>
                Use the Service in connection with the development, design, manufacture, or production
                of nuclear, chemical, biological, or radiological weapons, or any other weapons of mass
                destruction, or for any purpose prohibited by applicable export control laws including
                the UK Export Control Act 2002, EU Dual-Use Regulation, or the US Export Administration
                Regulations (EAR)
              </li>
              <li>
                Use the Service to process or store data that is subject to export control restrictions
                (including ITAR-controlled technical data) without ensuring compliance with all applicable
                export control regulations
              </li>
              <li>
                Resell, sublicence, or commercialise the Service or access to it without our express
                written permission
              </li>
            </ul>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>6. Intellectual Property and Licence Grants</h2>
            <p style={s.para}>
              The Service, including its software, design, computation engine, and content (other
              than Content you create), is owned by Godfrey Engineering Ltd and protected by
              intellectual property laws.
            </p>
            <p style={s.para}>
              <strong>Licence from us to you:</strong> Subject to these Terms, we grant you a
              limited, non-exclusive, non-transferable, revocable licence to access and use the
              Service for your personal or internal business purposes. This licence does not include
              any right to sublicence, resell, or otherwise transfer access to the Service.
            </p>
            <p style={s.para}>
              <strong>Licence from you to us:</strong> You retain full ownership of all Content you
              create using the Service. By using the Service, you grant us a limited, non-exclusive
              licence to host, process, and back up your Content solely to the extent necessary to
              operate the Service and provide it to you. We do not claim ownership of your
              Calculation Graphs or any results produced by them. We do not use your Content for
              training AI models or for any purpose other than operating the Service.
            </p>
            <p style={s.para}>
              <strong>Explore marketplace:</strong> If you publish Content on the Explore
              marketplace, you additionally grant us a non-exclusive, royalty-free licence to host
              and display that Content to other users of the Service. You represent that you have
              all rights necessary to grant these licences.
            </p>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>7. Subscriptions, Free Tier, and Payments</h2>
            <p style={s.para}>
              <strong>Free Tier:</strong> The Service is available under a free tier limited to 3
              projects, 500 MB of storage, and community support. Free tier users may not export
              PDF reports (or PDF exports include a ChainSolve watermark). The free tier is
              genuinely usable and is not artificially crippled.
            </p>
            <p style={s.para}>
              <strong>Paid Subscriptions:</strong> Enhanced features are available under paid
              subscription plans. All prices are displayed in Pounds Sterling (GBP, £) unless
              otherwise stated. VAT at the applicable UK standard rate (currently 20%) will be added
              where required by HMRC regulations. Subscriptions are billed in advance on a monthly
              or annual basis via Stripe.
            </p>
            <p style={s.para}>
              <strong>Cancellation:</strong> You may cancel your subscription at any time via
              account settings or the Stripe Customer Portal. Cancellation takes effect at the end
              of the current billing period; you retain access to paid features until that date.
            </p>
            <p style={s.para}>
              <strong>Refunds:</strong> For new subscriptions, you may request a full refund within
              14 days of initial purchase (14-day cooling-off period — see Section 14). Annual
              subscriptions cancelled after 14 days may be refunded on a pro-rated basis at our
              discretion. Monthly subscriptions are non-refundable after the billing period has
              commenced (except as required by law).
            </p>
            <p style={s.para}>
              <strong>Price changes:</strong> We will give at least 30 days&rsquo; notice of price
              changes by email. If you do not cancel before the new price takes effect, your
              continued use of the Service constitutes acceptance of the new price.
            </p>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>8. Data and Privacy</h2>
            <p style={s.para}>
              Your use of the Service is also governed by our{' '}
              <Link to="/privacy" style={s.link}>
                Privacy Policy
              </Link>
              . We collect only the data necessary to provide the Service. Your project data is
              stored securely and is not shared with third parties except as required to operate the
              Service (e.g. cloud hosting providers). You may export or delete your data at any
              time.
            </p>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>8. Calculation Accuracy Disclaimer</h2>
            <p style={s.para}>
              <strong>
                ChainSolve is provided as a calculation aid only. All results must be independently
                verified before reliance for safety-critical, structural, medical, financial, or
                life-safety applications.
              </strong>{' '}
              Godfrey Engineering Ltd accepts no liability for losses or damages arising from
              reliance on calculations performed using the Service. The Service is not a substitute
              for professional engineering, scientific, or financial advice. Users are solely
              responsible for validating outputs against applicable standards and regulations.
            </p>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>9. Availability and Warranties</h2>
            <p style={s.para}>
              The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without
              warranty of any kind, whether express or implied, including but not limited to
              warranties of merchantability, fitness for a particular purpose, accuracy, or
              non-infringement. We do not guarantee that the Service will be uninterrupted or
              error-free.
            </p>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>10. Limitation of Liability</h2>
            <p style={s.para}>
              To the fullest extent permitted by applicable law, Godfrey Engineering Ltd&apos;s
              aggregate liability to you for all claims arising from or relating to the Service
              shall not exceed the greater of £100 or the total amount you paid to us in the 12
              months preceding the claim. We shall not be liable for any indirect, incidental,
              special, consequential, or punitive damages, or any loss of profits or revenue,
              whether incurred directly or indirectly.
            </p>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>11. Termination</h2>
            <p style={s.para}>
              We may suspend or terminate your access to the Service with notice for violation of
              these Terms. You may terminate your account at any time via account settings. Upon
              termination: (a) your right to use the Service ceases immediately; (b) your data
              remains accessible in read-only mode for 30 days so you may export it; (c) your data
              will be permanently deleted within 90 days of account deletion. Financial records are
              retained for 7 years as required by HMRC.
            </p>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>12. Modifications to These Terms</h2>
            <p style={s.para}>
              We may modify these Terms from time to time. For material changes, we will notify you
              by email at least 30 days before the changes take effect. Continued use of the Service
              after the effective date constitutes acceptance of the revised Terms. The current
              version and effective date are always displayed at the top of this page.
            </p>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>13. Governing Law and Jurisdiction</h2>
            <p style={s.para}>
              These Terms are governed by the laws of England and Wales. Any disputes arising from
              or relating to these Terms or the Service shall be subject to the exclusive
              jurisdiction of the courts of England and Wales.
            </p>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>14. Consumer Rights (UK)</h2>
            <p style={s.para}>
              Nothing in these Terms affects your statutory rights as a consumer under the Consumer
              Rights Act 2015 or the Consumer Contracts (Information, Cancellation and Additional
              Charges) Regulations 2013. If you are a UK consumer purchasing a subscription, you
              have a 14-day right to cancel from the date of purchase. Exercising this right will
              terminate your access to paid features immediately. Contact us at{' '}
              <a href={`mailto:${CONTACT.support}`} style={s.link}>
                {CONTACT.support}
              </a>{' '}
              to exercise your cancellation right.
            </p>
          </section>

          <section style={s.section}>
            <h2 style={s.heading}>15. Contact</h2>
            <p style={s.para}>
              If you have questions about these Terms, contact us at{' '}
              <a href={`mailto:${CONTACT.support}`} style={s.link}>
                {CONTACT.support}
              </a>
              . Godfrey Engineering Ltd, registered in England and Wales.
            </p>
          </section>
        </article>

        <footer style={s.footer}>
          <Link to="/login" style={s.footerLink}>
            {t('terms.backToSignIn')}
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
  } as React.CSSProperties,
  footerLink: {
    color: 'var(--primary)',
    fontSize: '0.9rem',
    textDecoration: 'underline',
  } as React.CSSProperties,
}
