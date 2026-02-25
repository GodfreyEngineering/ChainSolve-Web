/**
 * Full-screen error shown when the WASM compute engine fails to initialize.
 *
 * This is the "no fallback" screen — the app cannot function without the
 * engine, so we offer retry and full page reload.
 */

interface Props {
  error: Error
  onRetry: () => void
}

export function EngineFatalError({ error, onRetry }: Props) {
  return (
    <div
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
      <h2 style={{ fontSize: '1.5rem', marginBottom: '0.75rem', color: '#f87171' }}>
        Engine failed to load
      </h2>
      <p style={{ maxWidth: '28rem', marginBottom: '1.5rem', lineHeight: 1.5, color: '#a1a1aa' }}>
        The compute engine could not initialize. This may be caused by a browser extension blocking
        WebAssembly or a network issue.
      </p>
      <code
        style={{
          display: 'block',
          maxWidth: '28rem',
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
      <div style={{ display: 'flex', gap: '0.75rem' }}>
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
          Retry
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
          Reload page
        </a>
      </div>
    </div>
  )
}
