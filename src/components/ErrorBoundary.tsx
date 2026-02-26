import { Component, type ReactNode, type ErrorInfo } from 'react'
import { captureReactBoundary } from '../observability/client'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
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
            color: '#F4F4F3',
          }}
        >
          <div style={{ maxWidth: '480px', textAlign: 'center' }}>
            <h2 style={{ margin: '0 0 0.75rem', color: '#f87171' }}>Something went wrong</h2>
            <p style={{ opacity: 0.6, marginBottom: '1rem', fontSize: '0.9rem' }}>
              {this.state.error.message}
            </p>
            <p style={{ opacity: 0.35, marginBottom: '1.5rem', fontSize: '0.75rem' }}>
              Check browser DevTools (F12 → Console) for details.
            </p>
            <button
              style={{
                padding: '0.6rem 1.25rem',
                borderRadius: '8px',
                border: 'none',
                background: '#646cff',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              onClick={() => this.setState({ error: null })}
            >
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
