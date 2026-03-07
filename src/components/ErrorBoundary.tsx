import { Component, type CSSProperties, type ReactNode, type ErrorInfo } from 'react'
import i18n from '../i18n/config'
import { captureReactBoundary } from '../observability/client'
import { CONTACT } from '../lib/brand'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * PanelErrorBoundary — lightweight inline error boundary for individual panels.
 * Shows a compact error message within the panel without taking over the viewport.
 */
interface PanelProps {
  children: ReactNode
  name?: string
}

export class PanelErrorBoundary extends Component<PanelProps, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      `[PanelErrorBoundary:${this.props.name ?? 'unknown'}]`,
      error,
      info.componentStack,
    )
    captureReactBoundary(error, info.componentStack ?? undefined)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={panelErrorStyle}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem' }}>
            {this.props.name
              ? i18n.t('errorBoundary.panelCrashed', { name: this.props.name })
              : i18n.t('errorBoundary.title')}
          </p>
          <p style={{ margin: '0.25rem 0 0', opacity: 0.6, fontSize: '0.75rem' }}>
            {this.state.error.message}
          </p>
          <button style={panelRetryStyle} onClick={() => this.setState({ error: null })}>
            {i18n.t('errorBoundary.tryAgain')}
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

const panelErrorStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1.5rem',
  textAlign: 'center',
  color: 'var(--text)',
  height: '100%',
  minHeight: 80,
}

const panelRetryStyle: CSSProperties = {
  marginTop: '0.75rem',
  padding: '0.35rem 0.85rem',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--border)',
  background: 'var(--surface-2)',
  color: 'var(--text)',
  fontSize: '0.75rem',
  cursor: 'pointer',
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
    // Report to observability pipeline (best-effort; captureReactBoundary never throws)
    captureReactBoundary(error, info.componentStack ?? undefined)
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            background: '#1a1a1a',
            color: 'var(--text)',
          }}
        >
          <div style={{ maxWidth: '480px', textAlign: 'center' }}>
            <h2 style={{ margin: '0 0 0.75rem', color: 'var(--danger-text)' }}>
              {i18n.t('errorBoundary.title')}
            </h2>
            <p style={{ opacity: 0.6, marginBottom: '1rem', fontSize: '0.9rem' }}>
              {this.state.error.message}
            </p>
            <p style={{ opacity: 0.35, marginBottom: '0.75rem', fontSize: '0.75rem' }}>
              {i18n.t('errorBoundary.devToolsHint')}
            </p>
            <p style={{ opacity: 0.35, marginBottom: '1.5rem', fontSize: '0.75rem' }}>
              {i18n.t('errorBoundary.needHelp')}{' '}
              <a
                href={`mailto:${CONTACT.support}`}
                style={{ color: 'var(--primary)', textDecoration: 'none' }}
              >
                {CONTACT.support}
              </a>
            </p>
            <button
              style={{
                padding: '0.6rem 1.25rem',
                borderRadius: 'var(--radius-lg)',
                border: 'none',
                background: 'var(--primary)',
                color: 'var(--color-on-primary)',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              onClick={() => this.setState({ error: null })}
            >
              {i18n.t('errorBoundary.tryAgain')}
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
