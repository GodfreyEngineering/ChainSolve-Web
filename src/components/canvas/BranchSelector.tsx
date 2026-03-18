/**
 * BranchSelector — 5.9: Branch selector dropdown for the canvas toolbar.
 *
 * Shows the current branch name with a dropdown to:
 *  - Switch to an existing branch (loads latest snapshot)
 *  - Create a new branch (forks from current state)
 *  - Delete a branch (except 'main')
 *
 * The component is displayed in the canvas toolbar area near the Run button.
 * It communicates with branchService.ts for all Supabase operations.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProjectBranch } from '../../lib/branchService'
import {
  listBranches,
  createBranch,
  deleteBranch,
  ensureMainBranch,
} from '../../lib/branchService'
import type { Node, Edge } from '@xyflow/react'

interface BranchSelectorProps {
  projectId: string
  canvasId: string
  currentBranch: string
  onBranchSwitch: (branchName: string) => Promise<void>
  /** Current canvas state for forking. */
  getCurrentGraph: () => { nodes: Node[]; edges: Edge[] }
}

export function BranchSelector({
  projectId,
  canvasId,
  currentBranch,
  onBranchSwitch,
  getCurrentGraph,
}: BranchSelectorProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [branches, setBranches] = useState<ProjectBranch[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const loadBranches = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await ensureMainBranch(projectId, canvasId)
      const data = await listBranches(projectId, canvasId)
      setBranches(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load branches')
    } finally {
      setLoading(false)
    }
  }, [projectId, canvasId])

  const handleOpen = useCallback(() => {
    setOpen((v) => {
      if (!v) loadBranches()
      return !v
    })
  }, [loadBranches])

  const handleSwitch = useCallback(
    async (branchName: string) => {
      if (branchName === currentBranch) {
        setOpen(false)
        return
      }
      setOpen(false)
      await onBranchSwitch(branchName)
    },
    [currentBranch, onBranchSwitch],
  )

  const handleCreate = useCallback(async () => {
    const name = newBranchName.trim()
    if (!name) return
    setCreating(true)
    setError(null)
    try {
      const { nodes, edges } = getCurrentGraph()
      await createBranch(projectId, canvasId, name, null, null, nodes, edges)
      setNewBranchName('')
      setCreating(false)
      await loadBranches()
      await onBranchSwitch(name)
      setOpen(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create branch')
      setCreating(false)
    }
  }, [newBranchName, projectId, canvasId, getCurrentGraph, loadBranches, onBranchSwitch])

  const handleDelete = useCallback(
    async (branchName: string, e: React.MouseEvent) => {
      e.stopPropagation()
      if (!window.confirm(t('branch.confirmDelete', `Delete branch "${branchName}"?`))) return
      try {
        await deleteBranch(projectId, canvasId, branchName)
        await loadBranches()
        if (branchName === currentBranch) {
          await onBranchSwitch('main')
          setOpen(false)
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to delete branch')
      }
    },
    [projectId, canvasId, currentBranch, loadBranches, onBranchSwitch, t],
  )

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-flex' }}>
      {/* Branch pill button */}
      <button
        onClick={handleOpen}
        title={t('branch.switchBranch', 'Switch branch')}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: open ? '#2a2a2a' : '#1e1e1e',
          border: '1px solid #333', borderRadius: 6,
          padding: '3px 10px 3px 7px',
          color: '#F4F4F3', fontSize: 11, cursor: 'pointer',
          fontFamily: 'JetBrains Mono, monospace',
          transition: 'background 0.15s',
        }}
      >
        <span style={{ fontSize: 10, opacity: 0.7 }}>⎇</span>
        <span>{currentBranch}</span>
        <span style={{ fontSize: 8, opacity: 0.5 }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, marginTop: 4,
          background: '#1e1e1e', border: '1px solid #333', borderRadius: 8,
          minWidth: 220, maxHeight: 320, overflowY: 'auto',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          zIndex: 9999, padding: '6px 0',
        }}>
          <div style={{ fontSize: 9, color: '#666', padding: '2px 12px 6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {t('branch.branches', 'Branches')}
          </div>

          {loading && (
            <div style={{ fontSize: 10, color: '#666', padding: '6px 12px' }}>
              {t('branch.loading', 'Loading…')}
            </div>
          )}

          {!loading && branches.map((b) => (
            <div
              key={b.id}
              onClick={() => handleSwitch(b.branch_name)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', cursor: 'pointer',
                background: b.branch_name === currentBranch ? '#2a2a2a' : 'transparent',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => {
                if (b.branch_name !== currentBranch)
                  (e.currentTarget as HTMLElement).style.background = '#222'
              }}
              onMouseLeave={(e) => {
                if (b.branch_name !== currentBranch)
                  (e.currentTarget as HTMLElement).style.background = 'transparent'
              }}
            >
              <span style={{ fontSize: 10, color: b.branch_name === currentBranch ? '#1CABB0' : '#666' }}>⎇</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: b.branch_name === currentBranch ? '#F4F4F3' : '#aaa', fontFamily: 'JetBrains Mono, monospace' }}>
                  {b.branch_name}
                  {b.branch_name === currentBranch && <span style={{ marginLeft: 6, fontSize: 8, color: '#1CABB0' }}>●</span>}
                </div>
                <div style={{ fontSize: 8, color: '#555' }}>
                  {b.snapshot_count} {t('branch.snapshots', 'snapshots')}
                  {b.latest_at && ` · ${new Date(b.latest_at).toLocaleDateString()}`}
                </div>
              </div>
              {b.branch_name !== 'main' && (
                <button
                  onClick={(e) => handleDelete(b.branch_name, e)}
                  title={t('branch.delete', 'Delete branch')}
                  style={{
                    background: 'none', border: 'none', color: '#e74c3c',
                    cursor: 'pointer', fontSize: 12, padding: '0 2px', opacity: 0.6,
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}

          {/* Create new branch */}
          <div style={{ borderTop: '1px solid #2a2a2a', margin: '6px 0', padding: '6px 12px 4px' }}>
            <div style={{ fontSize: 9, color: '#666', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {t('branch.create', 'Create branch')}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                type="text"
                placeholder={t('branch.namePlaceholder', 'branch-name')}
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                style={{
                  flex: 1, background: '#111', color: '#F4F4F3',
                  border: '1px solid #333', borderRadius: 4,
                  padding: '3px 6px', fontSize: 10,
                  fontFamily: 'JetBrains Mono, monospace', outline: 'none',
                }}
              />
              <button
                onClick={handleCreate}
                disabled={!newBranchName.trim() || creating}
                style={{
                  background: '#1CABB0', color: '#fff', border: 'none',
                  borderRadius: 4, padding: '3px 8px', fontSize: 10,
                  cursor: newBranchName.trim() && !creating ? 'pointer' : 'not-allowed',
                  opacity: newBranchName.trim() && !creating ? 1 : 0.5,
                }}
              >
                {creating ? '…' : t('branch.createBtn', 'Create')}
              </button>
            </div>
          </div>

          {error && (
            <div style={{ fontSize: 9, color: '#e74c3c', padding: '0 12px 6px' }}>
              ⚠ {error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
