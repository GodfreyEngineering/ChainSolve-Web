/**
 * CanvasPage — full-page canvas editor.
 *
 * Route: /canvas/:projectId   (project mode — autosaved to Supabase storage)
 *        /canvas              (scratch mode — no persistence)
 *
 * Lifecycle:
 *   1. Mount → load project.json from storage (when projectId is present).
 *   2. CanvasArea fires onGraphChange on every node/edge mutation (dirty tracking).
 *   3. 2 s debounce → doSave() pulls live snapshot via canvasRef → saveProject().
 *   4. Conflict detected → banner with "Keep mine" / "Reload" choices.
 *
 * W5.1 fixes:
 *   - doSave() uses canvasRef.getSnapshot() for authoritative graph state
 *     (replaces stale pendingNodes/pendingEdges refs that caused blank reopens).
 *   - "Save now" button + Ctrl+S for immediate save.
 *   - beforeunload handler flushes a best-effort save on tab close.
 *   - Route-leave handler saves before navigating back to /app.
 *   - Status label shows saved node/edge counts for debugging.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { CanvasArea, type CanvasAreaProps, type CanvasAreaHandle } from '../components/canvas/CanvasArea'
import { INITIAL_NODES, INITIAL_EDGES } from '../components/canvas/canvasDefaults'
import type { Node, Edge } from '@xyflow/react'
import type { NodeData } from '../blocks/registry'
import {
  loadProject,
  saveProject,
  renameProject,
  readProjectRow,
  type ProjectJSON,
} from '../lib/projects'
import { useProjectStore } from '../stores/projectStore'
import { supabase } from '../lib/supabase'
import { isReadOnly, showBillingBanner, type Plan } from '../lib/entitlements'

const AUTOSAVE_DELAY_MS = 2000

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export default function CanvasPage() {
  const { projectId } = useParams<{ projectId?: string }>()
  const navigate = useNavigate()

  // ── Store selectors ────────────────────────────────────────────────────────
  const saveStatus = useProjectStore((s) => s.saveStatus)
  const projectName = useProjectStore((s) => s.projectName)
  const errorMessage = useProjectStore((s) => s.errorMessage)
  const isDirty = useProjectStore((s) => s.isDirty)
  const lastSavedAt = useProjectStore((s) => s.lastSavedAt)

  const beginLoad = useProjectStore((s) => s.beginLoad)
  const markDirty = useProjectStore((s) => s.markDirty)
  const beginSave = useProjectStore((s) => s.beginSave)
  const completeSave = useProjectStore((s) => s.completeSave)
  const failSave = useProjectStore((s) => s.failSave)
  const detectConflict = useProjectStore((s) => s.detectConflict)
  const setStoreName = useProjectStore((s) => s.setProjectName)
  const reset = useProjectStore((s) => s.reset)

  // ── Plan awareness ───────────────────────────────────────────────────────
  const [plan, setPlan] = useState<Plan>('free')

  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session || cancelled) return
      supabase
        .from('profiles')
        .select('plan')
        .eq('id', session.user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (!cancelled && data?.plan) setPlan(data.plan as Plan)
        })
    })
    return () => {
      cancelled = true
    }
  }, [])

  const readOnly = isReadOnly(plan) && !!projectId
  const bannerKind = showBillingBanner(plan)

  // ── Load state ────────────────────────────────────────────────────────────
  const [loadPhase, setLoadPhase] = useState<'loading' | 'ready' | 'error'>(
    projectId ? 'loading' : 'ready',
  )
  const [loadError, setLoadError] = useState<string | null>(null)
  const [initNodes, setInitNodes] = useState<Node<NodeData>[] | undefined>()
  const [initEdges, setInitEdges] = useState<Edge[] | undefined>()

  // ── Autosave / conflict refs ───────────────────────────────────────────────
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const canvasRef = useRef<CanvasAreaHandle>(null)
  const isSaving = useRef(false)
  const conflictServerTs = useRef<string | null>(null)

  // ── Saved counts for status display ─────────────────────────────────────────
  const [savedCounts, setSavedCounts] = useState<{ nodes: number; edges: number } | null>(null)

  // ── Inline project name editing ───────────────────────────────────────────
  const [nameEditing, setNameEditing] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  // ── Load project on mount (or when projectId changes) ─────────────────────
  useEffect(() => {
    reset()
    conflictServerTs.current = null

    if (!projectId) {
      setLoadPhase('ready')
      return
    }

    setLoadPhase('loading')
    setLoadError(null)

    Promise.all([readProjectRow(projectId), loadProject(projectId)])
      .then(([row, pj]: [{ name: string; updated_at: string } | null, ProjectJSON]) => {
        const dbUpdatedAt = row?.updated_at ?? pj.updatedAt
        const dbName = row?.name ?? pj.project.name
        beginLoad(projectId, dbName, dbUpdatedAt, pj.formatVersion, pj.createdAt)
        setInitNodes(pj.graph.nodes as Node<NodeData>[])
        setInitEdges(pj.graph.edges as Edge[])
        setLoadPhase('ready')
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : 'Failed to load project')
        setLoadPhase('error')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    }
  }, [])

  // ── Core save function ────────────────────────────────────────────────────
  // Uses canvasRef.getSnapshot() to get the authoritative live graph state,
  // instead of relying on stale refs (which caused blank reopens).
  const doSave = useCallback(
    async (opts?: { forceKnownUpdatedAt?: string }) => {
      if (!projectId || isSaving.current) return

      const snapshot = canvasRef.current?.getSnapshot()
      if (!snapshot) return

      const state = useProjectStore.getState()
      const knownUpdatedAt = opts?.forceKnownUpdatedAt ?? state.dbUpdatedAt
      if (!knownUpdatedAt) return

      isSaving.current = true
      beginSave()

      try {
        const result = await saveProject(
          projectId,
          state.projectName,
          snapshot.nodes,
          snapshot.edges,
          knownUpdatedAt,
          {
            formatVersion: state.formatVersion,
            createdAt: state.createdAt ?? new Date().toISOString(),
          },
        )

        if (result.conflict) {
          conflictServerTs.current = result.updatedAt
          detectConflict()
        } else {
          conflictServerTs.current = null
          completeSave(result.updatedAt)
          setSavedCounts({ nodes: snapshot.nodes.length, edges: snapshot.edges.length })
        }
      } catch (err: unknown) {
        failSave(err instanceof Error ? err.message : 'Save failed')
      } finally {
        isSaving.current = false
      }
    },
    [projectId, beginSave, completeSave, failSave, detectConflict],
  )

  // ── onGraphChange — dirty tracking + debounced autosave ────────────────────
  // Note: we do NOT capture nodes/edges here for the save — doSave() pulls the
  // authoritative snapshot from canvasRef at save time. This avoids the stale-ref
  // bug where pendingNodes was empty on first render.
  const handleGraphChange: NonNullable<CanvasAreaProps['onGraphChange']> = useCallback(
    () => {
      markDirty()
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
      autosaveTimer.current = setTimeout(() => {
        void doSave()
      }, AUTOSAVE_DELAY_MS)
    },
    [markDirty, doSave],
  )

  // ── Flush save on tab close / refresh (best-effort) ────────────────────────
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!useProjectStore.getState().isDirty || !projectId) return
      void doSave()
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [projectId, doSave])

  // ── Ctrl+S / Cmd+S → immediate save ────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (projectId && !readOnly) void doSave()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [projectId, readOnly, doSave])

  // ── Route-leave: save before navigating back to /app ──────────────────────
  const handleBackToProjects = useCallback(
    async (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault()
      if (useProjectStore.getState().isDirty && projectId) {
        await doSave()
      }
      navigate('/app')
    },
    [projectId, doSave, navigate],
  )

  // ── Inline project name editing ───────────────────────────────────────────
  const startNameEdit = useCallback(() => {
    setNameInput(useProjectStore.getState().projectName)
    setNameEditing(true)
    setTimeout(() => nameInputRef.current?.select(), 0)
  }, [])

  const commitNameEdit = useCallback(async () => {
    setNameEditing(false)
    const trimmed = nameInput.trim()
    const current = useProjectStore.getState().projectName
    if (!trimmed || !projectId || trimmed === current) return
    try {
      await renameProject(projectId, trimmed)
      setStoreName(trimmed)
    } catch {
      // Silently revert — the store still holds the old name
    }
  }, [nameInput, projectId, setStoreName])

  // ── Conflict resolution ───────────────────────────────────────────────────
  const handleOverwrite = useCallback(() => {
    const serverTs = conflictServerTs.current
    if (!serverTs) return
    void doSave({ forceKnownUpdatedAt: serverTs })
  }, [doSave])

  const handleReload = useCallback(() => {
    window.location.reload()
  }, [])

  // ── Save status label ─────────────────────────────────────────────────────
  const statusLabel: { text: string; color: string } | null = (() => {
    if (!projectId) return null
    switch (saveStatus) {
      case 'saving':
        return { text: 'Saving…', color: 'rgba(244,244,243,0.45)' }
      case 'saved':
        return {
          text: savedCounts
            ? `Saved ${savedCounts.nodes}n / ${savedCounts.edges}e · ${lastSavedAt ? fmtTime(lastSavedAt) : ''}`
            : `Saved ${lastSavedAt ? fmtTime(lastSavedAt) : ''}`,
          color: '#22c55e',
        }
      case 'conflict':
        return { text: '⚠ Conflict', color: '#f59e0b' }
      case 'error':
        return { text: '⚠ Save failed', color: '#ef4444' }
      default:
        return isDirty ? { text: 'Unsaved', color: 'rgba(244,244,243,0.45)' } : null
    }
  })()

  // ── Loading / error screens ───────────────────────────────────────────────
  if (loadPhase === 'loading') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.5,
        }}
      >
        Loading project…
      </div>
    )
  }

  if (loadPhase === 'error') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
        }}
      >
        <p style={{ color: '#ef4444', margin: 0 }}>{loadError}</p>
        <a href="/app" style={{ opacity: 0.6, fontSize: '0.85rem', color: 'inherit' }}>
          ← Back to projects
        </a>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--bg)',
      }}
    >
      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '0 1rem',
          height: 44,
          borderBottom: '1px solid var(--border)',
          background: 'var(--card-bg)',
          flexShrink: 0,
        }}
      >
        <a
          href="/app"
          onClick={handleBackToProjects}
          style={{ fontSize: '0.82rem', opacity: 0.6, textDecoration: 'none', color: 'inherit' }}
        >
          ← Projects
        </a>

        <div style={{ width: 1, height: 18, background: 'var(--border)' }} />

        {/* Project name — click to rename (disabled in read-only) */}
        {projectId && !nameEditing && (
          <span
            onClick={readOnly ? undefined : startNameEdit}
            title={readOnly ? undefined : 'Click to rename'}
            style={{
              fontWeight: 700,
              fontSize: '0.95rem',
              letterSpacing: '-0.3px',
              cursor: readOnly ? 'default' : 'text',
              borderBottom: '1px solid transparent',
              userSelect: 'none',
              paddingBottom: 1,
            }}
            onMouseOver={(e) => {
              ;(e.currentTarget as HTMLElement).style.borderBottomColor = 'rgba(255,255,255,0.2)'
            }}
            onMouseOut={(e) => {
              ;(e.currentTarget as HTMLElement).style.borderBottomColor = 'transparent'
            }}
          >
            {projectName}
          </span>
        )}
        {projectId && nameEditing && (
          <input
            ref={nameInputRef}
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={() => {
              void commitNameEdit()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                void commitNameEdit()
              }
              if (e.key === 'Escape') {
                setNameEditing(false)
              }
            }}
            style={{
              fontWeight: 700,
              fontSize: '0.95rem',
              letterSpacing: '-0.3px',
              background: 'transparent',
              border: 'none',
              borderBottom: '1px solid var(--primary)',
              outline: 'none',
              color: 'inherit',
              width: 220,
              padding: 0,
              fontFamily: 'inherit',
            }}
          />
        )}
        {!projectId && (
          <span style={{ fontWeight: 600, fontSize: '0.9rem', opacity: 0.4 }}>Scratch canvas</span>
        )}

        {/* Save status badge */}
        {statusLabel && (
          <span style={{ fontSize: '0.72rem', color: statusLabel.color }}>{statusLabel.text}</span>
        )}
        {saveStatus === 'error' && errorMessage && (
          <span
            title={errorMessage}
            style={{
              fontSize: '0.7rem',
              color: '#ef4444',
              opacity: 0.75,
              maxWidth: 200,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {errorMessage}
          </span>
        )}

        {/* Save now button (project mode only) */}
        {projectId && !readOnly && (
          <button
            onClick={() => void doSave()}
            disabled={!isDirty || saveStatus === 'saving'}
            style={{
              padding: '0.15rem 0.55rem',
              borderRadius: 5,
              border: '1px solid rgba(255,255,255,0.12)',
              background: isDirty ? 'rgba(28,171,176,0.15)' : 'transparent',
              color: isDirty ? '#1CABB0' : 'rgba(244,244,243,0.35)',
              cursor: isDirty ? 'pointer' : 'default',
              fontSize: '0.72rem',
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
            title="Save now (Ctrl+S)"
          >
            Save
          </button>
        )}

        <span style={{ marginLeft: 'auto', fontSize: '0.72rem', opacity: 0.35 }}>
          Drag blocks · Connect handles · Delete to remove
        </span>
      </div>

      {/* ── Read-only / billing banner ──────────────────────────────────────── */}
      {readOnly && (
        <div
          style={{
            background: 'rgba(239,68,68,0.1)',
            borderBottom: '1px solid rgba(239,68,68,0.3)',
            padding: '0.45rem 1rem',
            fontSize: '0.82rem',
            color: '#f87171',
            flexShrink: 0,
          }}
        >
          Your subscription has been canceled. This project is read-only.
        </div>
      )}
      {bannerKind === 'past_due' && (
        <div
          style={{
            background: 'rgba(245,158,11,0.1)',
            borderBottom: '1px solid rgba(245,158,11,0.3)',
            padding: '0.45rem 1rem',
            fontSize: '0.82rem',
            color: '#fbbf24',
            flexShrink: 0,
          }}
        >
          Your payment is past due. Please update your billing info to avoid losing access.
        </div>
      )}

      {/* ── Conflict banner ───────────────────────────────────────────────────── */}
      {saveStatus === 'conflict' && (
        <div
          style={{
            background: 'rgba(245,158,11,0.1)',
            borderBottom: '1px solid rgba(245,158,11,0.3)',
            padding: '0.45rem 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            fontSize: '0.82rem',
            color: '#fbbf24',
            flexShrink: 0,
          }}
        >
          <span>Another session saved this project — your local changes may conflict.</span>
          <button
            onClick={handleOverwrite}
            style={{
              padding: '0.2rem 0.75rem',
              border: '1px solid rgba(245,158,11,0.4)',
              background: 'transparent',
              color: '#fbbf24',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontFamily: 'inherit',
            }}
          >
            Keep mine (overwrite)
          </button>
          <button
            onClick={handleReload}
            style={{
              padding: '0.2rem 0.75rem',
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'transparent',
              color: 'rgba(244,244,243,0.65)',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontFamily: 'inherit',
            }}
          >
            Reload from server
          </button>
        </div>
      )}

      {/* ── Canvas ───────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        <CanvasArea
          ref={canvasRef}
          key={projectId ?? 'scratch'}
          initialNodes={initNodes ?? INITIAL_NODES}
          initialEdges={initEdges ?? INITIAL_EDGES}
          onGraphChange={projectId && !readOnly ? handleGraphChange : undefined}
          readOnly={readOnly}
          plan={plan}
        />
      </div>
    </div>
  )
}
