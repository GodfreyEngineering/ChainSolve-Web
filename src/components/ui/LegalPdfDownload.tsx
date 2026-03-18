/**
 * LegalPdfDownload — Print-to-PDF button for legal pages (16.77).
 *
 * Uses the browser's built-in print dialog (which supports "Save as PDF"
 * in all modern browsers) to let enterprise customers download PDF versions
 * of legal documents for procurement paperwork.
 *
 * A print stylesheet (applied via <style> injection during print) removes
 * the navigation, footer, and cookie banner so only the document content
 * is printed.
 */

import { useCallback } from 'react'

interface LegalPdfDownloadProps {
  /** Suggested filename for the PDF (without extension) */
  filename: string
}

export function LegalPdfDownload({ filename }: LegalPdfDownloadProps) {
  const handlePrint = useCallback(() => {
    // Temporarily set document title so "Save as PDF" uses a good default name
    const originalTitle = document.title
    document.title = filename
    window.print()
    // Restore title after print dialog closes (or times out)
    setTimeout(() => {
      document.title = originalTitle
    }, 1000)
  }, [filename])

  return (
    <button
      onClick={handlePrint}
      style={btnStyle}
      aria-label={`Download ${filename} as PDF`}
      title="Open print dialog to save as PDF"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      Download PDF
    </button>
  )
}

const btnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.4rem',
  padding: '0.4rem 0.85rem',
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  color: 'var(--text-faint)',
  fontSize: '0.8rem',
  fontFamily: 'inherit',
  cursor: 'pointer',
  transition: 'border-color 0.15s, color 0.15s',
  whiteSpace: 'nowrap',
}
