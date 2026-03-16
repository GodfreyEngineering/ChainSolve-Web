/**
 * ProjectsPanel — sidebar tab showing the user's projects with folder tree (PROJ-04).
 *
 * Features:
 *   - PROJ-05: Fuzzy search with match highlighting
 *   - PROJ-04: Expandable folder nodes, drag-to-move, folder CRUD
 */

import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  Plus,
  Search,
  Upload,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  Folder,
  RefreshCw,
} from 'lucide-react'
import {
  listProjects,
  renameProject,
  deleteProject,
  duplicateProject,
  importProject,
  validateProjectJSON,
  moveToFolder,
  createProject,
  type ProjectRow,
} from '../../../lib/projects'
import { validateProjectName } from '../../../lib/validateProjectName'
import { canCreateProject, getEntitlements, type Plan } from '../../../lib/entitlements'
import { getPinnedProjects, togglePinnedProject } from '../../../lib/pinnedProjects'
import { removeRecentProject } from '../../../lib/recentProjects'
import { useProjectStore } from '../../../stores/projectStore'
import { useCanvasesStore } from '../../../stores/canvasesStore'
import { Icon } from '../../ui/Icon'
import { Tooltip } from '../../ui/Tooltip'

// ── Local-storage key for extra empty folders ────────────────────────────────

const CUSTOM_FOLDERS_KEY = 'cs:customFolders'

function loadCustomFolders(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_FOLDERS_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

function saveCustomFolders(folders: string[]): void {
  try {
    localStorage.setItem(CUSTOM_FOLDERS_KEY, JSON.stringify(folders))
  } catch {
    // ignore
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ProjectsPanelProps {
  plan: Plan
  onOpenProject: (projectId: string) => void
  onNewProject: () => void
}

// ── ProjectsPanel ─────────────────────────────────────────────────────────────

export function ProjectsPanel({ plan, onOpenProject, onNewProject }: ProjectsPanelProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => getPinnedProjects())
  const [menuOpen, setMenuOpen] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)
  // Folder state
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => new Set())
  const [folderMenu, setFolderMenu] = useState<string | null>(null) // folder name with menu open
  const [customFolders, setCustomFolders] = useState<string[]>(loadCustomFolders)
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null)
  const [dragProjectId, setDragProjectId] = useState<string | null>(null)

  const fetchProjects = useCallback(async () => {
    try {
      const rows = await listProjects()
      setProjects(rows)
    } catch {
      // ignore
    }
    setLoading(false)
  }, [])

  // Fetch on mount
  useEffect(() => {
    void fetchProjects()
  }, [fetchProjects])

  // Auto-refresh when a project save completes (saveStatus transitions to 'saved')
  useEffect(() => {
    return useProjectStore.subscribe((state, prev) => {
      if (state.saveStatus === 'saved' && prev.saveStatus !== 'saved') {
        void fetchProjects()
      }
    })
  }, [fetchProjects])

  const ent = getEntitlements(plan)
  const allowCreate = canCreateProject(plan, projects.length)

  // ── Derived folder list ──────────────────────────────────────────────────────

  const allFolders = useMemo(() => {
    const dbFolders = new Set(
      projects.map((p) => p.folder).filter((f): f is string => f != null && f.length > 0),
    )
    const merged = new Set([...dbFolders, ...customFolders])
    return [...merged].sort((a, b) => a.localeCompare(b))
  }, [projects, customFolders])

  // Remove custom folders that now have real projects
  useEffect(() => {
    const dbFolders = new Set(projects.map((p) => p.folder).filter((f): f is string => f != null))
    setCustomFolders((prev) => {
      const next = prev.filter((f) => !dbFolders.has(f))
      saveCustomFolders(next)
      return next
    })
  }, [projects])

  // ── Search / filter ──────────────────────────────────────────────────────────

  const scored = useMemo(() => {
    const q = query.trim()
    type Scored = { project: ProjectRow; score: number; matchIndices: number[] }
    let result: Scored[]
    if (q) {
      result = projects
        .map((p) => {
          const m = fuzzyMatch(q, p.name)
          return m ? { project: p, score: m.score, matchIndices: m.indices } : null
        })
        .filter((x): x is Scored => x !== null)
    } else {
      result = projects.map((p) => ({ project: p, score: 1, matchIndices: [] }))
    }
    return result.sort((a, b) => {
      const ap = pinnedIds.has(a.project.id) ? 0 : 1
      const bp = pinnedIds.has(b.project.id) ? 0 : 1
      if (ap !== bp) return ap - bp
      if (q && a.score !== b.score) return b.score - a.score
      return new Date(b.project.updated_at).getTime() - new Date(a.project.updated_at).getTime()
    })
  }, [projects, query, pinnedIds])

  // ── Import ────────────────────────────────────────────────────────────────────

  const handleImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      setImporting(true)
      try {
        const text = await file.text()
        let raw: unknown
        try {
          raw = JSON.parse(text)
        } catch {
          window.alert(t('home.importErrorInvalidJson', 'Import failed: not a valid JSON file.'))
          return
        }
        const validation = validateProjectJSON(raw)
        if (!validation.ok) {
          window.alert(
            t('home.importErrorValidation', 'Import failed: {{error}}', {
              error: validation.error,
            }),
          )
          return
        }
        if (validation.warnings.length > 0) {
          const proceed = window.confirm(
            t('home.importWarnings', 'Import warnings:\n\n{{warnings}}\n\nContinue anyway?', {
              warnings: validation.warnings.join('\n'),
            }),
          )
          if (!proceed) return
        }
        await importProject(validation.json)
        fetchProjects()
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        window.alert(t('home.importErrorFailed', 'Import failed: {{error}}', { error: msg }))
      } finally {
        setImporting(false)
        if (importRef.current) importRef.current.value = ''
      }
    },
    [fetchProjects, t],
  )

  // ── Project actions ───────────────────────────────────────────────────────────

  const handleRename = useCallback(
    async (proj: ProjectRow) => {
      setMenuOpen(null)
      const next = window.prompt(t('home.renamePrompt', 'Rename project:'), proj.name)
      if (!next?.trim() || next.trim() === proj.name) return
      const validation = validateProjectName(next.trim())
      if (!validation.ok) {
        window.alert(validation.error)
        return
      }
      try {
        await renameProject(proj.id, next.trim())
        fetchProjects()
      } catch (err: unknown) {
        window.alert(err instanceof Error ? err.message : 'Rename failed')
      }
    },
    [t, fetchProjects],
  )

  const handleDuplicate = useCallback(
    async (proj: ProjectRow) => {
      setMenuOpen(null)
      try {
        await duplicateProject(proj.id, `${proj.name} (copy)`)
        fetchProjects()
      } catch (err: unknown) {
        window.alert(
          t('home.duplicateError', 'Duplicate failed: {{error}}', {
            error: err instanceof Error ? err.message : String(err),
          }),
        )
      }
    },
    [fetchProjects, t],
  )

  const handleDelete = useCallback(
    async (proj: ProjectRow) => {
      setMenuOpen(null)
      const isOpen = useProjectStore.getState().projectId === proj.id
      const confirmMsg = isOpen
        ? t(
            'home.confirmDeleteOpen',
            'This project is currently open. Close it and delete "{{name}}"?',
            { name: proj.name },
          )
        : t('home.confirmDelete', 'Delete "{{name}}"?', { name: proj.name })
      if (!window.confirm(confirmMsg)) return

      try {
        // If the project being deleted is currently open, navigate away first
        if (isOpen) {
          useProjectStore.getState().reset()
          useCanvasesStore.getState().reset()
          navigate('/app')
        }

        await deleteProject(proj.id)
        removeRecentProject(proj.id)
        fetchProjects()
      } catch (err: unknown) {
        window.alert(
          t('home.deleteError', 'Delete failed: {{error}}', {
            error: err instanceof Error ? err.message : String(err),
          }),
        )
      }
    },
    [t, fetchProjects, navigate],
  )

  const handlePin = useCallback((projId: string) => {
    setMenuOpen(null)
    setPinnedIds(togglePinnedProject(projId))
  }, [])

  const handleMoveToFolder = useCallback(
    async (projId: string, folder: string | null) => {
      setMenuOpen(null)
      try {
        await moveToFolder(projId, folder)
        fetchProjects()
      } catch (err: unknown) {
        window.alert(err instanceof Error ? err.message : 'Move failed')
      }
    },
    [fetchProjects],
  )

  // ── Folder actions ────────────────────────────────────────────────────────────

  const handleNewFolder = useCallback(() => {
    const name = window.prompt(t('folders.newFolderPrompt', 'Folder name:'))?.trim()
    if (!name) return
    if (allFolders.includes(name)) {
      window.alert(t('folders.alreadyExists', 'A folder with that name already exists.'))
      return
    }
    setCustomFolders((prev) => {
      const next = [...prev, name]
      saveCustomFolders(next)
      return next
    })
    setExpandedFolders((prev) => new Set([...prev, name]))
  }, [allFolders, t])

  const handleRenameFolder = useCallback(
    async (oldName: string) => {
      setFolderMenu(null)
      const next = window.prompt(t('folders.renamePrompt', 'Rename folder:'), oldName)?.trim()
      if (!next || next === oldName) return
      if (allFolders.includes(next)) {
        window.alert(t('folders.alreadyExists', 'A folder with that name already exists.'))
        return
      }
      try {
        const affected = projects.filter((p) => p.folder === oldName)
        await Promise.all(affected.map((p) => moveToFolder(p.id, next)))
        setCustomFolders((prev) => {
          const updated = prev.map((f) => (f === oldName ? next : f))
          saveCustomFolders(updated)
          return updated
        })
        fetchProjects()
      } catch (err: unknown) {
        window.alert(err instanceof Error ? err.message : 'Rename folder failed')
      }
    },
    [allFolders, projects, fetchProjects, t],
  )

  const handleDeleteFolder = useCallback(
    async (folderName: string) => {
      setFolderMenu(null)
      const affected = projects.filter((p) => p.folder === folderName)
      const msg =
        affected.length > 0
          ? t(
              'folders.confirmDelete',
              'Delete folder "{{name}}"? {{count}} project(s) will be moved to Unfiled.',
              { name: folderName, count: affected.length },
            )
          : t('folders.confirmDeleteEmpty', 'Delete empty folder "{{name}}"?', {
              name: folderName,
            })
      if (!window.confirm(msg)) return
      try {
        await Promise.all(affected.map((p) => moveToFolder(p.id, null)))
        setCustomFolders((prev) => {
          const next = prev.filter((f) => f !== folderName)
          saveCustomFolders(next)
          return next
        })
        fetchProjects()
      } catch (err: unknown) {
        window.alert(err instanceof Error ? err.message : 'Delete folder failed')
      }
    },
    [projects, fetchProjects, t],
  )

  const handleNewProjectInFolder = useCallback(
    async (folderName: string) => {
      setFolderMenu(null)
      if (!allowCreate) return
      try {
        const proj = await createProject('Untitled project', folderName)
        fetchProjects()
        onOpenProject(proj.id)
      } catch (err: unknown) {
        window.alert(err instanceof Error ? err.message : 'Create project failed')
      }
    },
    [allowCreate, fetchProjects, onOpenProject],
  )

  // ── Drag-and-drop ─────────────────────────────────────────────────────────────

  const handleDragStart = useCallback((projId: string) => {
    setDragProjectId(projId)
  }, [])

  const handleDropOnFolder = useCallback(
    async (folder: string | null) => {
      if (!dragProjectId) return
      setDragOverFolder(null)
      setDragProjectId(null)
      try {
        await moveToFolder(dragProjectId, folder)
        fetchProjects()
      } catch (err: unknown) {
        window.alert(err instanceof Error ? err.message : 'Move failed')
      }
    },
    [dragProjectId, fetchProjects],
  )

  // ── Render helpers ────────────────────────────────────────────────────────────

  const toggleFolder = useCallback((name: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }, [])

  const renderProjectRow = (proj: ProjectRow, matchIndices: number[]) => (
    <ProjectItem
      key={proj.id}
      project={proj}
      pinned={pinnedIds.has(proj.id)}
      matchIndices={matchIndices}
      menuOpen={menuOpen === proj.id}
      folders={allFolders}
      onOpen={() => onOpenProject(proj.id)}
      onMenuToggle={() => setMenuOpen(menuOpen === proj.id ? null : proj.id)}
      onRename={() => handleRename(proj)}
      onDuplicate={() => handleDuplicate(proj)}
      onDelete={() => handleDelete(proj)}
      onPin={() => handlePin(proj.id)}
      onMoveToFolder={(f) => handleMoveToFolder(proj.id, f)}
      onDragStart={() => handleDragStart(proj.id)}
    />
  )

  // In search mode: flat list
  if (query.trim()) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <PanelHeader
          query={query}
          setQuery={setQuery}
          allowCreate={allowCreate}
          importing={importing}
          importRef={importRef}
          onNewProject={onNewProject}
          onNewFolder={handleNewFolder}
          onImport={handleImport}
          onRefresh={fetchProjects}
          t={t}
        />
        <div style={countStyle}>
          {ent.maxProjects === Infinity
            ? `${projects.length} ${t('sidebar.projectsCount', 'projects')}`
            : `${projects.length} / ${ent.maxProjects}`}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 0.3rem 0.5rem' }}>
          {scored.map(({ project: proj, matchIndices }) => renderProjectRow(proj, matchIndices))}
        </div>
      </div>
    )
  }

  // Folder tree mode
  const projectsByFolder = new Map<string | null, ProjectRow[]>()
  projectsByFolder.set(null, [])
  for (const folder of allFolders) projectsByFolder.set(folder, [])
  for (const p of projects) {
    const f = p.folder ?? null
    if (!projectsByFolder.has(f)) projectsByFolder.set(f, [])
    projectsByFolder.get(f)!.push(p)
  }

  const sortProjects = (list: ProjectRow[]) =>
    [...list].sort((a, b) => {
      const ap = pinnedIds.has(a.id) ? 0 : 1
      const bp = pinnedIds.has(b.id) ? 0 : 1
      if (ap !== bp) return ap - bp
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })

  const unfiled = sortProjects(projectsByFolder.get(null) ?? [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <PanelHeader
        query={query}
        setQuery={setQuery}
        allowCreate={allowCreate}
        importing={importing}
        importRef={importRef}
        onNewProject={onNewProject}
        onNewFolder={handleNewFolder}
        onImport={handleImport}
        onRefresh={fetchProjects}
        t={t}
      />
      <div style={countStyle}>
        {ent.maxProjects === Infinity
          ? `${projects.length} ${t('sidebar.projectsCount', 'projects')}`
          : `${projects.length} / ${ent.maxProjects}`}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 0.3rem 0.5rem' }}>
        {loading && projects.length === 0 && (
          <div style={emptyStyle}>{t('home.loadingProjects', 'Loading...')}</div>
        )}
        {!loading && projects.length === 0 && allFolders.length === 0 && (
          <div
            style={{
              ...emptyStyle,
              gap: '0.5rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: '2rem', opacity: 0.35 }}>📁</div>
            <div style={{ fontWeight: 600, opacity: 0.6 }}>
              {t('home.noProjectsTitle', 'No projects yet')}
            </div>
            <div style={{ fontSize: '0.68rem', opacity: 0.4 }}>
              {t('home.noProjectsHint', 'Create your first project to get started')}
            </div>
            {canCreateProject(plan, 0) && (
              <button style={createFirstBtnStyle} onClick={onNewProject}>
                + {t('home.createFirstProject', 'Create project')}
              </button>
            )}
          </div>
        )}

        {/* Folders */}
        {allFolders.map((folder) => {
          const folderProjects = sortProjects(projectsByFolder.get(folder) ?? [])
          const expanded = expandedFolders.has(folder)
          const isOver = dragOverFolder === folder
          return (
            <div key={folder}>
              {/* Folder header */}
              <div
                style={{
                  ...folderHeaderStyle,
                  background: isOver ? 'var(--primary-dim)' : 'transparent',
                  outline: isOver ? '2px solid var(--primary)' : 'none',
                  borderRadius: 5,
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOverFolder(folder)
                }}
                onDragLeave={() => setDragOverFolder(null)}
                onDrop={(e) => {
                  e.preventDefault()
                  void handleDropOnFolder(folder)
                }}
              >
                <button
                  style={folderToggleBtn}
                  onClick={() => toggleFolder(folder)}
                  aria-label={expanded ? 'Collapse folder' : 'Expand folder'}
                >
                  <Icon icon={expanded ? ChevronDown : ChevronRight} size={12} />
                  <Icon
                    icon={Folder}
                    size={13}
                    style={{ color: 'var(--primary)', marginLeft: 2 }}
                  />
                  <span style={folderNameStyle}>{folder}</span>
                  {folderProjects.length > 0 && (
                    <span style={folderCountBadge}>{folderProjects.length}</span>
                  )}
                </button>

                {/* Folder context menu button */}
                <button
                  style={folderMenuBtn}
                  onClick={(e) => {
                    e.stopPropagation()
                    setFolderMenu(folderMenu === folder ? null : folder)
                  }}
                  aria-label={t('projects.folderOptions')}
                >
                  ⋯
                </button>

                {folderMenu === folder && (
                  <div style={folderMenuStyle}>
                    <button
                      className="cs-header-dropdown-item"
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleNewProjectInFolder(folder)
                      }}
                    >
                      {t('folders.newProjectHere', 'New project here')}
                    </button>
                    <button
                      className="cs-header-dropdown-item"
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleRenameFolder(folder)
                      }}
                    >
                      {t('folders.rename', 'Rename')}
                    </button>
                    <div style={{ height: 1, background: 'var(--border)', margin: '0.15rem 0' }} />
                    <button
                      className="cs-header-dropdown-item"
                      style={{ color: 'var(--danger)' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        void handleDeleteFolder(folder)
                      }}
                    >
                      {t('folders.delete', 'Delete folder')}
                    </button>
                  </div>
                )}
              </div>

              {/* Folder contents */}
              {expanded && (
                <div style={{ paddingLeft: '1rem' }}>
                  {folderProjects.length === 0 ? (
                    <div style={folderEmptyStyle}>
                      {t('folders.empty', 'Empty — drag a project here')}
                    </div>
                  ) : (
                    folderProjects.map((proj) => renderProjectRow(proj, []))
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Unfiled section */}
        {unfiled.length > 0 && (
          <>
            {allFolders.length > 0 && (
              <div
                style={unfiledHeaderStyle}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOverFolder('__unfiled__')
                }}
                onDragLeave={() => setDragOverFolder(null)}
                onDrop={(e) => {
                  e.preventDefault()
                  void handleDropOnFolder(null)
                }}
              >
                <span style={{ flex: 1 }}>{t('folders.unfiled', 'Unfiled')}</span>
                {dragOverFolder === '__unfiled__' && (
                  <span style={{ fontSize: '0.65rem', color: 'var(--primary)' }}>
                    {t('folders.dropHere', 'Drop here')}
                  </span>
                )}
              </div>
            )}
            {unfiled.map((proj) => renderProjectRow(proj, []))}
          </>
        )}
      </div>
    </div>
  )
}

// ── PanelHeader ───────────────────────────────────────────────────────────────

function PanelHeader({
  query,
  setQuery,
  allowCreate,
  importing,
  importRef,
  onNewProject,
  onNewFolder,
  onImport,
  onRefresh,
  t,
}: {
  query: string
  setQuery: (q: string) => void
  allowCreate: boolean
  importing: boolean
  importRef: React.RefObject<HTMLInputElement | null>
  onNewProject: () => void
  onNewFolder: () => void
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRefresh: () => void
  t: ReturnType<typeof useTranslation>['t']
}) {
  return (
    <div style={headerStyle}>
      <div style={searchRowStyle}>
        <Icon icon={Search} size={13} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
        <input
          type="search"
          placeholder={t('home.searchProjects', 'Search projects...')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={searchInputStyle}
        />
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        <Tooltip content={t('sidebar.refresh', 'Refresh')} side="bottom">
          <button
            style={actionBtnStyle}
            onClick={onRefresh}
            aria-label={t('sidebar.refresh', 'Refresh')}
          >
            <Icon icon={RefreshCw} size={14} />
          </button>
        </Tooltip>
        <Tooltip content={t('home.createProject', 'New project')} side="bottom">
          <button
            data-tour="btn-new-project"
            style={actionBtnStyle}
            onClick={onNewProject}
            disabled={!allowCreate}
            aria-label={t('home.createProject')}
          >
            <Icon icon={Plus} size={14} />
          </button>
        </Tooltip>
        <Tooltip content={t('folders.newFolder', 'New folder')} side="bottom">
          <button style={actionBtnStyle} onClick={onNewFolder} aria-label={t('folders.newFolder')}>
            <Icon icon={FolderPlus} size={14} />
          </button>
        </Tooltip>
        <Tooltip content={t('home.importProject', 'Import')} side="bottom">
          <button
            style={{ ...actionBtnStyle, opacity: importing ? 0.5 : undefined }}
            onClick={() => !importing && importRef.current?.click()}
            aria-label={t('home.importProject')}
            disabled={importing}
          >
            <Icon icon={Upload} size={14} />
          </button>
        </Tooltip>
        <input
          ref={importRef}
          type="file"
          accept=".json,.chainsolvejson"
          style={{ display: 'none' }}
          onChange={onImport}
        />
      </div>
    </div>
  )
}

// ── ProjectItem ───────────────────────────────────────────────────────────────

interface ProjectItemProps {
  project: ProjectRow
  pinned: boolean
  matchIndices: number[]
  menuOpen: boolean
  folders: string[]
  onOpen: () => void
  onMenuToggle: () => void
  onRename: () => void
  onDuplicate: () => void
  onDelete: () => void
  onPin: () => void
  onMoveToFolder: (folder: string | null) => void
  onDragStart: () => void
}

function ProjectItem({
  project,
  pinned,
  matchIndices,
  menuOpen,
  folders,
  onOpen,
  onMenuToggle,
  onRename,
  onDuplicate,
  onDelete,
  onPin,
  onMoveToFolder,
  onDragStart,
}: ProjectItemProps) {
  const [hovered, setHovered] = useState(false)
  const [movingTo, setMovingTo] = useState(false)

  return (
    <div
      draggable
      style={{
        ...rowStyle,
        background: hovered ? 'var(--primary-dim)' : 'transparent',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false)
        if (menuOpen) onMenuToggle()
      }}
      onClick={onOpen}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        onDragStart()
      }}
      onDragEnd={() => {
        setHovered(false)
      }}
    >
      {pinned && (
        <span style={{ fontSize: '0.6rem', color: 'var(--warning)', flexShrink: 0 }}>★</span>
      )}
      <span style={rowNameStyle}>
        <HighlightedName name={project.name} indices={matchIndices} />
      </span>
      <span style={rowDateStyle}>{fmtDate(project.updated_at)}</span>
      {hovered && (
        <div style={{ position: 'relative' }}>
          <button
            style={menuBtnStyle}
            onClick={(e) => {
              e.stopPropagation()
              onMenuToggle()
            }}
          >
            ⋯
          </button>
          {menuOpen && (
            <div style={menuStyle}>
              <button
                className="cs-header-dropdown-item"
                onClick={(e) => {
                  e.stopPropagation()
                  onOpen()
                }}
              >
                Open
              </button>
              <button
                className="cs-header-dropdown-item"
                onClick={(e) => {
                  e.stopPropagation()
                  onPin()
                }}
              >
                {pinned ? 'Unpin' : 'Pin'}
              </button>
              <button
                className="cs-header-dropdown-item"
                onClick={(e) => {
                  e.stopPropagation()
                  onRename()
                }}
              >
                Rename
              </button>
              <button
                className="cs-header-dropdown-item"
                onClick={(e) => {
                  e.stopPropagation()
                  onDuplicate()
                }}
              >
                Duplicate
              </button>

              {/* Move to folder */}
              {(folders.length > 0 || project.folder) && (
                <>
                  <div style={{ height: 1, background: 'var(--border)', margin: '0.15rem 0' }} />
                  <button
                    className="cs-header-dropdown-item"
                    onClick={(e) => {
                      e.stopPropagation()
                      setMovingTo((v) => !v)
                    }}
                  >
                    Move to folder ›
                  </button>
                  {movingTo && (
                    <div style={subMenuStyle}>
                      {project.folder && (
                        <button
                          className="cs-header-dropdown-item"
                          onClick={(e) => {
                            e.stopPropagation()
                            setMovingTo(false)
                            onMoveToFolder(null)
                          }}
                        >
                          Remove from folder
                        </button>
                      )}
                      {folders
                        .filter((f) => f !== project.folder)
                        .map((f) => (
                          <button
                            key={f}
                            className="cs-header-dropdown-item"
                            onClick={(e) => {
                              e.stopPropagation()
                              setMovingTo(false)
                              onMoveToFolder(f)
                            }}
                          >
                            {f}
                          </button>
                        ))}
                    </div>
                  )}
                </>
              )}

              <div style={{ height: 1, background: 'var(--border)', margin: '0.15rem 0' }} />
              <button
                className="cs-header-dropdown-item"
                style={{ color: 'var(--danger)' }}
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete()
                }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Fuzzy match ───────────────────────────────────────────────────────────────

function fuzzyMatch(query: string, target: string): { score: number; indices: number[] } | null {
  if (!query) return { score: 1, indices: [] }
  const q = query.toLowerCase()
  const tl = target.toLowerCase()
  const indices: number[] = []
  let qi = 0
  let ti = 0
  while (qi < q.length && ti < tl.length) {
    if (q[qi] === tl[ti]) {
      indices.push(ti)
      qi++
    }
    ti++
  }
  if (qi < q.length) return null
  let score = 1
  let run = 1
  for (let i = 1; i < indices.length; i++) {
    if (indices[i] === indices[i - 1] + 1) {
      run++
      score += run
    } else {
      run = 1
    }
  }
  if (indices[0] === 0) score += 10
  return { score, indices }
}

// ── HighlightedName ───────────────────────────────────────────────────────────

function HighlightedName({ name, indices }: { name: string; indices: number[] }) {
  if (indices.length === 0) return <>{name}</>
  const set = new Set(indices)
  const parts: React.ReactNode[] = []
  let i = 0
  while (i < name.length) {
    if (set.has(i)) {
      let j = i
      while (j < name.length && set.has(j)) j++
      parts.push(
        <span key={i} style={{ color: 'var(--primary)', fontWeight: 600 }}>
          {name.slice(i, j)}
        </span>,
      )
      i = j
    } else {
      let j = i
      while (j < name.length && !set.has(j)) j++
      parts.push(<span key={i}>{name.slice(i, j)}</span>)
      i = j
    }
  }
  return <>{parts}</>
}

function fmtDate(iso: string): string {
  const d = new Date(iso)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '0.4rem 0.5rem',
  borderBottom: '1px solid var(--border)',
  flexShrink: 0,
}

const searchRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  flex: 1,
  padding: '0.2rem 0.4rem',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--surface-3, rgba(0,0,0,0.15))',
}

const searchInputStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'var(--text)',
  fontSize: '0.72rem',
  outline: 'none',
  width: '100%',
  fontFamily: 'inherit',
}

const actionBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 26,
  height: 26,
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  background: 'transparent',
  color: 'var(--text)',
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const countStyle: React.CSSProperties = {
  padding: '0.25rem 0.6rem',
  fontSize: '0.62rem',
  color: 'var(--text-faint)',
  letterSpacing: '0.03em',
}

const emptyStyle: React.CSSProperties = {
  padding: '2rem 1rem',
  textAlign: 'center',
  fontSize: '0.78rem',
  color: 'var(--text-faint)',
}

const folderHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '0.2rem 0.3rem',
  cursor: 'pointer',
  position: 'relative',
  marginTop: 2,
}

const folderToggleBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  flex: 1,
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text)',
  fontFamily: 'inherit',
  padding: 0,
  textAlign: 'left',
}

const folderNameStyle: React.CSSProperties = {
  fontSize: '0.78rem',
  fontWeight: 600,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: 160,
}

const folderCountBadge: React.CSSProperties = {
  fontSize: '0.6rem',
  background: 'rgba(107,114,128,0.2)',
  color: 'var(--text-muted)',
  borderRadius: 8,
  padding: '0 5px',
  fontWeight: 600,
  marginLeft: 2,
  flexShrink: 0,
}

const folderMenuBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-faint)',
  fontSize: '0.85rem',
  padding: '0 4px',
  fontFamily: 'inherit',
  lineHeight: 1,
  flexShrink: 0,
}

const folderMenuStyle: React.CSSProperties = {
  position: 'absolute',
  right: 0,
  top: '100%',
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: '0.2rem',
  zIndex: 100,
  minWidth: 140,
  boxShadow: 'var(--shadow-lg)',
}

const folderEmptyStyle: React.CSSProperties = {
  padding: '0.4rem 0.5rem',
  fontSize: '0.68rem',
  color: 'var(--text-faint)',
  fontStyle: 'italic',
}

const unfiledHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '0.3rem 0.5rem',
  fontSize: '0.65rem',
  fontWeight: 700,
  color: 'var(--text-faint)',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  marginTop: 6,
  borderRadius: 5,
  cursor: 'default',
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '0.35rem 0.5rem',
  borderRadius: 'var(--radius-sm)',
  cursor: 'pointer',
  fontSize: '0.78rem',
  margin: '1px 0',
  position: 'relative',
}

const rowNameStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const rowDateStyle: React.CSSProperties = {
  fontSize: '0.62rem',
  color: 'var(--text-faint)',
  flexShrink: 0,
}

const menuBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--text-faint)',
  fontSize: '0.85rem',
  padding: '0 4px',
  fontFamily: 'inherit',
  lineHeight: 1,
}

const menuStyle: React.CSSProperties = {
  position: 'absolute',
  right: 0,
  top: '100%',
  background: 'var(--surface-2)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  padding: '0.2rem',
  zIndex: 100,
  minWidth: 140,
  boxShadow: 'var(--shadow-lg)',
}

const subMenuStyle: React.CSSProperties = {
  marginLeft: '0.5rem',
  borderLeft: '1px solid var(--border)',
  paddingLeft: '0.3rem',
}

const createFirstBtnStyle: React.CSSProperties = {
  marginTop: '0.3rem',
  padding: '0.4rem 1rem',
  borderRadius: 8,
  background: 'var(--primary)',
  border: 'none',
  color: '#fff',
  fontSize: '0.75rem',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
}
