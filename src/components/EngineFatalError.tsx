/**
 * Full-screen error shown when the WASM compute engine fails to initialize.
 *
 * This is the "no fallback" screen — the app cannot function without the
 * engine, so we offer retry and full page reload.
 *
 * Error codes (prefixed in error.message as [CODE]):
 *   WASM_CSP_BLOCKED   — WebAssembly blocked by Content Security Policy
 *   WASM_INIT_FAILED   — any other initialization failure
 *   CONTRACT_MISMATCH  — WASM contract version ≠ app expected version
 */

import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { CONTACT } from '../lib/brand'

interface Props {
  error: Error
  onRetry: () => void
}

export function EngineFatalError({ error, onRetry }: Props) {
  const { t } = useTranslation()

  // Extract structured error code from the message prefix, e.g. "[WASM_CSP_BLOCKED] …"
  const codeMatch = error.message.match(/^\[([A-Z_]+)\]/)
  const errorCode = codeMatch?.[1] ?? 'WASM_INIT_FAILED'
  const isCspBlocked = errorCode === 'WASM_CSP_BLOCKED'
  const isContractMismatch = errorCode === 'CONTRACT_MISMATCH'

  const [copied, setCopied] = useState(false)

  const handleCopyDiagnostics = useCallback(() => {
    const diag = JSON.stringify(
      {
        ts: new Date().toISOString(),
        errorCode,
        message: error.message,
        url: window.location.href,
        ua: navigator.userAgent,
      },
      null,
      2,
    )
    void navigator.clipboard.writeText(diag).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [error.message, errorCode])

  function getTitle(): string {
    if (isCspBlocked) return t('engineError.cspTitle')
    if (isContractMismatch) return t('engineError.mismatchTitle')
    return t('engineError.genericTitle')
  }

  function getDescription(): string {
    if (isCspBlocked) return t('engineError.cspDescription')
    if (isContractMismatch) return t('engineError.mismatchDescription')
    return t('engineError.genericDescription')
  }

  return (
    <div
      data-testid="engine-fatal"
      data-fatal-message={error.message}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#18181b',
        color: '#e4e4e7',
        fontFamily: 'system-ui, sans-serif',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#f87171' }}>{getTitle()}</h2>

      {/* Short error code badge */}
      <div style={{ marginBottom: '1rem' }}>
        <code
          style={{
            padding: '0.2rem 0.625rem',
            backgroundColor: '#3f3f46',
            borderRadius: '0.25rem',
            fontSize: '0.75rem',
            color: '#fca5a5',
          }}
        >
          {errorCode}
        </code>
      </div>

      <p style={{ maxWidth: '30rem', marginBottom: '1.5rem', lineHeight: 1.5, color: '#a1a1aa' }}>
        {getDescription()}
      </p>

      <code
        style={{
          display: 'block',
          maxWidth: '30rem',
          padding: '0.75rem 1rem',
          marginBottom: '1.5rem',
          backgroundColor: '#27272a',
          borderRadius: '0.375rem',
          fontSize: '0.8125rem',
          wordBreak: 'break-word',
          color: '#fca5a5',
        }}
      >
        {error.message}
      </code>

      <p
        style={{ maxWidth: '30rem', marginBottom: '1.5rem', fontSize: '0.82rem', color: '#71717a' }}
      >
        {t('engineError.needHelp')}{' '}
        <a href={`mailto:${CONTACT.support}`} style={{ color: '#93c5fd', textDecoration: 'none' }}>
          {CONTACT.support}
        </a>
      </p>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={onRetry}
          style={{
            padding: '0.5rem 1.25rem',
            backgroundColor: '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          {t('engineError.retry')}
        </button>
        <a
          href="/"
          style={{
            padding: '0.5rem 1.25rem',
            backgroundColor: '#3f3f46',
            color: '#e4e4e7',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          {t('engineError.reloadPage')}
        </a>
        <button
          onClick={handleCopyDiagnostics}
          style={{
            padding: '0.5rem 1.25rem',
            backgroundColor: '#27272a',
            color: '#a1a1aa',
            border: '1px solid #3f3f46',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          {copied ? t('engineError.copied') : t('engineError.copyDiagnostics')}
        </button>
      </div>
    </div>
  )
}
