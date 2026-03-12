/**
 * SharedProjectPage — read-only view of a project shared via a share link.
 *
 * Route: /share/:token
 *
 * Fetches project data from GET /api/share/:token (CF Function).
 * Renders the canvas in read-only mode.
 * "Fork" button allows authenticated users to copy the project.
 */

import { useEffect, useRef, useState, useCallback, lazy, Suspense } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { Node, Edge } from '@xyflow/react'
import type { CanvasAreaHandle } from '../components/canvas/CanvasArea'
import type { NodeData } from '../blocks/registry'
import { supabase } from '../lib/supabase'
import { createProject } from '../lib/projects'
import { createCanvas, saveCanvasGraph } from '../lib/canvases'
import { EngineContext, useEngine } from '../contexts/EngineContext'

const CanvasArea = lazy(() =>
  import('../components/canvas/CanvasArea').then((m) => ({ default: m.CanvasArea })),
)

// ── Types ──────────────────────────────────────────────────────────────────────

type ShareApiResponse = {
  ok: boolean
  error?: string
  project?: {
    id: string
    name: string
    description: string | null
    updatedAt: string
  }
  canvases?: Array<{
    id: string
    name: string
    position: number
    isActive: boolean
  }>
  canvasData?: Record<
    string,
    {
      graph?: { nodes: unknown[]; edges: unknown[] }
    }
  >
}

// ── SharedProjectPage ──────────────────────────────────────────────────────────

export function SharedProjectPage() {
  const { token } = useParams<{ token: string }>()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const canvasRef = useRef<CanvasAreaHandle>(null)
  const engine = useEngine()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<ShareApiResponse | null>(null)
  const [activeCanvasId, setActiveCanvasId] = useState<string | null>(null)
  const [forking, setForking] = useState(false)
  const [forkError, setForkError] = useState<string | null>(null)
  const [forkSuccess, setForkSuccess] = useState<string | null>(null) // projectId

  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session)
    })
  }, [])

  useEffect(() => {
    if (!token) {
      setError('Invalid share link')
      setLoading(false)
      return
    }

    fetch(`/api/share/${token}`)
      .then((r) => r.json())
      .then((d: ShareApiResponse) => {
        if (!d.ok) {
          setError(d.error ?? 'Failed to load shared project')
        } else {
          setData(d)
          // Set the active canvas to the first one (or the one marked is_active)
          const active = d.canvases?.find((c) => c.isActive) ?? d.canvases?.[0] ?? null
          setActiveCanvasId(active?.id ?? null)
        }
      })
      .catch(() => setError('Network error — could not load shared project'))
      .finally(() => setLoading(false))
  }, [token])

  const activeGraph = (() => {
    if (!data?.canvasData || !activeCanvasId) return { nodes: [], edges: [] }
    const cd = data.canvasData[activeCanvasId]
    if (cd?.graph) return cd.graph
    // Legacy: try __legacy__
    const legacy = data.canvasData['__legacy__']
    if (legacy?.graph) return legacy.graph
    return { nodes: [], edges: [] }
  })()

  const handleFork = useCallback(async () => {
    if (!data?.project || !isAuthenticated) {
      navigate('/login?redirect=' + encodeURIComponent(window.location.pathname))
      return
    }
    setForking(true)
    setForkError(null)
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) throw new Error('Not signed in')

      // Create a new project
      const newProject = await createProject(`${data.project.name} (fork)`)

      // Create canvases and copy graph data
      const canvases = data.canvases ?? []
      if (canvases.length === 0 && data.canvasData?.['__legacy__']) {
        // Legacy single-canvas
        const legacyGraph = data.canvasData['__legacy__'].graph ?? { nodes: [], edges: [] }
        const canvas = await createCanvas(newProject.id, 'Canvas 1')
        await saveCanvasGraph(
          newProject.id,
          canvas.id,
          legacyGraph.nodes ?? [],
          legacyGraph.edges ?? [],
        )
      } else {
        for (const canvas of canvases) {
          const graph = data.canvasData?.[canvas.id]?.graph ?? { nodes: [], edges: [] }
          const newCanvas = await createCanvas(newProject.id, canvas.name)
          await saveCanvasGraph(newProject.id, newCanvas.id, graph.nodes ?? [], graph.edges ?? [])
        }
      }

      setForkSuccess(newProject.id)
    } catch (err) {
      setForkError(err instanceof Error ? err.message : 'Fork failed')
    } finally {
      setForking(false)
    }
  }, [data, isAuthenticated, navigate])

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg)',
          color: 'var(--text)',
        }}
      >
        <div style={{ textAlign: 'center', opacity: 0.5 }}>{t('ui.loading', 'Loading…')}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg)',
          color: 'var(--text)',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 400, padding: '2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem', opacity: 0.4 }}>🔒</div>
          <h1 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem' }}>
            {t('share.linkUnavailable', 'Link unavailable')}
          </h1>
          <p style={{ opacity: 0.6, margin: '0 0 1.5rem', fontSize: '0.9rem' }}>{error}</p>
          <a
            href="/app"
            style={{
              display: 'inline-block',
              padding: '0.6rem 1.4rem',
              background: 'var(--primary)',
              color: '#fff',
              borderRadius: 8,
              fontWeight: 600,
              textDecoration: 'none',
              fontSize: '0.9rem',
            }}
          >
            {t('share.goToApp', 'Open ChainSolve')}
          </a>
        </div>
      </div>
    )
  }

  const canvases = data?.canvases ?? []

  return (
    <EngineContext.Provider value={engine}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          background: 'var(--bg)',
          color: 'var(--text)',
        }}
      >
        {/* Header */}
        <div
          style={{
            height: 46,
            display: 'flex',
            alignItems: 'center',
            padding: '0 1rem',
            background: 'var(--surface-1)',
            borderBottom: '1px solid var(--border)',
            gap: '0.75rem',
            flexShrink: 0,
          }}
        >
          <a
            href="/app"
            style={{
              fontWeight: 800,
              fontSize: '0.9rem',
              color: 'var(--primary)',
              textDecoration: 'none',
              letterSpacing: '0.02em',
              flexShrink: 0,
            }}
          >
            ChainSolve
          </a>
          <div
            style={{
              width: 1,
              height: 18,
              background: 'var(--border)',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontWeight: 600,
              fontSize: '0.9rem',
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {data?.project?.name}
          </span>
          <span
            style={{
              padding: '0.15rem 0.6rem',
              borderRadius: 10,
              fontSize: '0.72rem',
              fontWeight: 700,
              background: 'rgba(107,114,128,0.15)',
              color: 'var(--text-muted)',
              flexShrink: 0,
            }}
          >
            {t('share.readOnly', 'Read-only')}
          </span>
          {forkSuccess ? (
            <a
              href={`/app/${forkSuccess}`}
              style={{
                padding: '0.3rem 0.9rem',
                borderRadius: 8,
                background: 'rgba(34,197,94,0.15)',
                color: '#22c55e',
                border: '1px solid rgba(34,197,94,0.3)',
                fontWeight: 600,
                fontSize: '0.82rem',
                textDecoration: 'none',
                flexShrink: 0,
              }}
            >
              ✓ {t('share.openFork', 'Open fork')}
            </a>
          ) : (
            <button
              disabled={forking}
              onClick={() => void handleFork()}
              style={{
                padding: '0.3rem 0.9rem',
                borderRadius: 8,
                background: 'var(--primary)',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.82rem',
                cursor: forking ? 'not-allowed' : 'pointer',
                opacity: forking ? 0.6 : 1,
                flexShrink: 0,
                fontFamily: 'inherit',
              }}
            >
              {forking
                ? t('share.forking', 'Forking…')
                : isAuthenticated
                  ? t('share.fork', 'Fork project')
                  : t('share.signInToFork', 'Sign in to fork')}
            </button>
          )}
        </div>

        {forkError && (
          <div
            style={{
              padding: '0.5rem 1rem',
              background: 'rgba(239,68,68,0.12)',
              color: '#f87171',
              fontSize: '0.83rem',
              borderBottom: '1px solid rgba(239,68,68,0.2)',
            }}
          >
            {forkError}
          </div>
        )}

        {/* Canvas tabs (if multiple canvases) */}
        {canvases.length > 1 && (
          <div
            style={{
              display: 'flex',
              gap: '0.25rem',
              padding: '0 0.75rem',
              background: 'var(--surface-1)',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
              overflowX: 'auto',
            }}
          >
            {canvases.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCanvasId(c.id)}
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.8rem',
                  fontWeight: activeCanvasId === c.id ? 700 : 400,
                  background: 'transparent',
                  border: 'none',
                  borderBottom:
                    activeCanvasId === c.id ? '2px solid var(--primary)' : '2px solid transparent',
                  color: activeCanvasId === c.id ? 'var(--primary)' : 'var(--text-muted)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  fontFamily: 'inherit',
                }}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* Canvas */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <Suspense fallback={null}>
            <CanvasArea
              key={activeCanvasId ?? 'default'}
              ref={canvasRef}
              canvasId={activeCanvasId ?? undefined}
              initialNodes={(activeGraph.nodes as Node<NodeData>[]) ?? []}
              initialEdges={(activeGraph.edges as Edge[]) ?? []}
              readOnly
            />
          </Suspense>
        </div>
      </div>
    </EngineContext.Provider>
  )
}
