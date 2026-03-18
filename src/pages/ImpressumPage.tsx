/**
 * ImpressumPage — German TMG §5 legal disclosure.
 *
 * German law (Telemediengesetz §5) requires any commercial website
 * accessible in Germany to publish an Impressum with specific company
 * details. This page is served at /de/impressum and linked from the footer.
 *
 * Also satisfies Austrian ECG §5 and Swiss DSG equivalents.
 */

import { Link } from 'react-router-dom'
import { BRAND, COMPANY, CONTACT } from '../lib/brand'

const containerStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontFamily: 'Montserrat, sans-serif',
}

const innerStyle: React.CSSProperties = {
  maxWidth: 700,
  margin: '0 auto',
  padding: '3rem 1.5rem 5rem',
}

const logoStyle: React.CSSProperties = {
  display: 'block',
  height: 32,
  marginBottom: '2.5rem',
}

const h1Style: React.CSSProperties = {
  fontSize: '2rem',
  fontWeight: 700,
  marginBottom: '0.25rem',
}

const subtitleStyle: React.CSSProperties = {
  opacity: 0.5,
  fontSize: '0.85rem',
  marginBottom: '2.5rem',
}

const sectionStyle: React.CSSProperties = {
  marginBottom: '2rem',
}

const h2Style: React.CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  opacity: 0.5,
  marginBottom: '0.5rem',
}

const rowStyle: React.CSSProperties = {
  fontSize: '0.95rem',
  lineHeight: 1.7,
  opacity: 0.85,
}

const linkStyle: React.CSSProperties = {
  color: 'var(--primary)',
  textDecoration: 'none',
}

const dividerStyle: React.CSSProperties = {
  border: 'none',
  borderTop: '1px solid var(--border)',
  margin: '2rem 0',
}

const noteStyle: React.CSSProperties = {
  fontSize: '0.82rem',
  opacity: 0.45,
  lineHeight: 1.6,
}

const backStyle: React.CSSProperties = {
  display: 'inline-block',
  marginBottom: '1.5rem',
  fontSize: '0.85rem',
  color: 'var(--primary)',
  textDecoration: 'none',
  opacity: 0.8,
}

export default function ImpressumPage() {
  return (
    <div style={containerStyle}>
      <div style={innerStyle}>
        <Link to="/" style={backStyle}>
          ← Back
        </Link>

        <img src={BRAND.logoWideText} alt="ChainSolve" style={logoStyle} />

        <h1 style={h1Style}>Impressum</h1>
        <p style={subtitleStyle}>
          Angaben gemäß § 5 TMG (Telemediengesetz) / Legal Disclosure
        </p>

        {/* Diensteanbieter / Service Provider */}
        <section style={sectionStyle}>
          <h2 style={h2Style}>Diensteanbieter / Service Provider</h2>
          <div style={rowStyle}>
            <strong>{COMPANY.name}</strong>
            <br />
            Registered in {COMPANY.jurisdiction}
            <br />
            Company Number: {COMPANY.companyNumber}
          </div>
        </section>

        {/* Registered Address */}
        <section style={sectionStyle}>
          <h2 style={h2Style}>Registered Address / Anschrift</h2>
          <div style={rowStyle}>
            {COMPANY.registeredAddress}
            <br />
            United Kingdom
          </div>
        </section>

        {/* Managing Director */}
        <section style={sectionStyle}>
          <h2 style={h2Style}>
            Vertretungsberechtigte Person / Managing Director
          </h2>
          <div style={rowStyle}>{COMPANY.director}</div>
        </section>

        {/* Contact */}
        <section style={sectionStyle}>
          <h2 style={h2Style}>Kontakt / Contact</h2>
          <div style={rowStyle}>
            E-Mail:{' '}
            <a href={`mailto:${CONTACT.support}`} style={linkStyle}>
              {CONTACT.support}
            </a>
          </div>
        </section>

        {/* Companies House Registration */}
        <section style={sectionStyle}>
          <h2 style={h2Style}>
            Registereintrag / Companies House Registration
          </h2>
          <div style={rowStyle}>
            Register: Companies House (England &amp; Wales)
            <br />
            Registration number: {COMPANY.companyNumber}
            <br />
            <a
              href={`https://find-and-update.company-information.service.gov.uk/company/${COMPANY.companyNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              style={linkStyle}
            >
              View on Companies House →
            </a>
          </div>
        </section>

        {/* VAT */}
        <section style={sectionStyle}>
          <h2 style={h2Style}>USt-IdNr. / VAT Number</h2>
          <div style={rowStyle}>
            VAT registration pending. This disclosure will be updated upon
            receipt of a VAT registration number from HMRC.
          </div>
        </section>

        {/* Platform / Streitschlichtung */}
        <section style={sectionStyle}>
          <h2 style={h2Style}>
            Online-Streitbeilegung / Online Dispute Resolution
          </h2>
          <div style={rowStyle}>
            Die Europäische Kommission stellt eine Plattform zur
            Online-Streitbeilegung (OS) bereit:{' '}
            <a
              href="https://ec.europa.eu/consumers/odr/"
              target="_blank"
              rel="noopener noreferrer"
              style={linkStyle}
            >
              https://ec.europa.eu/consumers/odr/
            </a>
            <br />
            <br />
            The European Commission provides a platform for online dispute
            resolution (ODR). We are not obliged and not willing to participate
            in dispute resolution proceedings before a consumer arbitration
            board.
          </div>
        </section>

        {/* Haftungsausschluss */}
        <section style={sectionStyle}>
          <h2 style={h2Style}>Haftungsausschluss / Disclaimer</h2>
          <div style={rowStyle}>
            Despite careful content control, we assume no liability for the
            content of external links. The operators of the linked pages are
            solely responsible for their content.
          </div>
        </section>

        <hr style={dividerStyle} />

        <p style={noteStyle}>
          ChainSolve is a product of {COMPANY.name}, registered in{' '}
          {COMPANY.jurisdiction}. This Impressum was last reviewed on 17 March
          2026. For privacy information, see our{' '}
          <Link to="/privacy" style={linkStyle}>
            Privacy Policy
          </Link>
          . For terms of use, see our{' '}
          <Link to="/terms" style={linkStyle}>
            Terms of Service
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
