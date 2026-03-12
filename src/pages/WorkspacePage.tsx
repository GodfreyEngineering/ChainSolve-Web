/**
 * WorkspacePage — unified single-page workspace (V3-UI).
 *
 * Composes:
 *   - WorkspaceToolbar (36px top bar)
 *   - LeftSidebar (collapsible, 320px default)
 *   - Main area: CanvasPage (project or scratch) or WelcomeCanvas (empty state)
 *
 * Auth flow:
 *   1. Loading → LoadingScreen
 *   2. Needs gate (email verify / ToS) → AuthGate
 *   3. Needs signup wizard → SignupWizard
 *   4. Needs MFA prompt → MfaSetupPrompt
 *   5. First run → FirstRunModal
 *   6. Normal workspace view
 *
 * Scratch mode:
 *   - Activated via "Scratch Canvas" action or ?scratch=1 query param
 *   - Loads CanvasPage embedded with no projectId
 *   - URL stays at /app
 */

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useWorkspaceAuth } from '../hooks/useWorkspaceAuth'
import { WorkspaceToolbar } from '../components/app/WorkspaceToolbar'
import { LeftSidebar } from '../components/app/LeftSidebar'
import { WelcomeCanvas } from '../components/canvas/WelcomeCanvas'
import { LoadingScreen } from '../components/ui/LoadingScreen'
import { useSidebarStore } from '../stores/sidebarStore'
import { StatusBar } from '../components/app/StatusBar'
import { RightSidebar } from '../components/app/RightSidebar'
import { useStatusBarStore } from '../stores/statusBarStore'
import { listProjects, importProject, type ProjectJSON } from '../lib/projects'
import { canCreateProject, isAtProjectLimit } from '../lib/entitlements'
import { NewProjectModal } from '../components/app/NewProjectModal'
import { useToast } from '../components/ui/useToast'
import { PanelErrorBoundary } from '../components/ErrorBoundary'
import type { CanvasControls } from './CanvasPage'

// Lazy-load heavy components
const LazyAuthGate = lazy(() => import('../components/AuthGate'))
const LazySessionRevokedModal = lazy(() =>
  import('../components/ui/SessionRevokedModal').then((m) => ({
    default: m.SessionRevokedModal,
  })),
)
const LazySignupWizard = lazy(() =>
  import('../components/app/SignupWizard').then((m) => ({ default: m.SignupWizard })),
)
const LazyMfaSetupPrompt = lazy(() =>
  import('../components/app/MfaSetupPrompt').then((m) => ({ default: m.MfaSetupPrompt })),
)
const LazyFirstRunModal = lazy(() =>
  import('../components/app/FirstRunModal').then((m) => ({ default: m.FirstRunModal })),
)

// Lazy-load CanvasPage to keep the workspace shell fast
const CanvasPage = lazy(() => import('./CanvasPage'))

const ONBOARDED_KEY = 'cs:onboarded'

/** Shown when profile row is missing after all retries. Shows actual error for diagnosis. */
function ProfileFallback({
  error,
  refreshProfile,
  onSignOut,
}: {
  error: string | null
  refreshProfile: () => Promise<void>
  onSignOut: () => Promise<void>
}) {
  const { t } = useTranslation()
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)

  const handleRetry = async () => {
    setRetrying(true)
    setRetryError(null)
    try {
      await refreshProfile()
      // Reload to restart the auth flow cleanly
      window.location.reload()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[auth] profile retry failed:', msg)
      setRetryError(msg)
      setRetrying(false)
    }
  }

  const displayError = retryError || error

  return (
    <div style={profileFallbackStyle}>
      <h2>{t('workspace.settingUp', 'Setting up your account\u2026')}</h2>
      <p>{t('workspace.settingUpHint', 'This usually takes a moment. Please refresh the page.')}</p>
      {displayError && (
        <div style={profileErrorStyle}>
          <strong>Error:</strong> {displayError}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleRetry} disabled={retrying} style={refreshBtnStyle}>
          {retrying ? 'Retrying\u2026' : t('workspace.tryAgain', 'Try again')}
        </button>
        <button onClick={onSignOut} style={refreshBtnStyle}>
          {t('nav.signOut', 'Sign out')}
        </button>
      </div>
    </div>
  )
}

export default function WorkspacePage() {
  const { projectId } = useParams<{ projectId?: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const auth = useWorkspaceAuth()
  const { open: sidebarOpen, toggle: toggleSidebar, setActiveTab } = useSidebarStore()
  const { toast } = useToast()
  const { t } = useTranslation()
  const inspectedNodeId = useStatusBarStore((s) => s.inspectedNodeId)
  const importRef = useRef<HTMLInputElement>(null)

  // Canvas controls exposed by embedded CanvasPage (Phase M)
  const [canvasControls, setCanvasControls] = useState<CanvasControls | null>(null)

  // New project modal
  const [showNewProjectModal, setShowNewProjectModal] = useState(false)

  // Scratch mode: activated by ?scratch=1 param or user action
  const [scratchMode, setScratchMode] = useState(() => searchParams.get('scratch') === '1')

  // Auto-open sidebar to Explore tab if ?tab=explore is in the URL
  useEffect(() => {
    if (searchParams.get('tab') === 'explore') {
      setActiveTab('explore')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [firstRunOpen, setFirstRunOpen] = useState(() => {
    try {
      return !localStorage.getItem(ONBOARDED_KEY)
    } catch {
      return false
    }
  })

  const showCanvas = !!projectId || scratchMode

  const handleOpenProject = useCallback(
    (id: string) => {
      setScratchMode(false)
      navigate(`/app/${id}`)
    },
    [navigate],
  )

  const handleNewProject = useCallback(async () => {
    try {
      const projects = await listProjects()
      if (!canCreateProject(auth.plan, projects.length)) {
        if (isAtProjectLimit(auth.plan, projects.length)) {
          toast(
            t(
              'workspace.freePlanLimit',
              'Free plan allows 1 project. Opening scratch canvas — delete your project or upgrade to save.',
            ),
            'info',
          )
          setScratchMode(true)
          return
        }
        toast(
          t('workspace.projectLimitReached', 'Project limit reached. Upgrade to create more.'),
          'error',
        )
        return
      }
      setShowNewProjectModal(true)
    } catch (err: unknown) {
      toast(
        err instanceof Error
          ? err.message
          : t('workspace.createFailed', 'Failed to create project'),
        'error',
      )
    }
  }, [auth.plan, toast, t])

  const handleOpenScratch = useCallback(() => {
    setScratchMode(true)
  }, [])

  const handleOpenExplore = useCallback(() => {
    setActiveTab('explore')
    if (!sidebarOpen) toggleSidebar()
  }, [setActiveTab, sidebarOpen, toggleSidebar])

  const handleImport = useCallback(async () => {
    importRef.current?.click()
  }, [])

  const handleImportFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const json = JSON.parse(text) as ProjectJSON
        const result = await importProject(json)
        if (result?.id) {
          toast(t('workspace.importSuccess', 'Project imported'), 'success')
          navigate(`/app/${result.id}`)
        }
      } catch (err: unknown) {
        toast(
          err instanceof Error
            ? err.message
            : t('workspace.importFailed', 'Failed to import project'),
          'error',
        )
      }
      if (importRef.current) importRef.current.value = ''
    },
    [navigate, toast, t],
  )

  // ── Auth guards ────────────────────────────────────────────────────

  if (auth.loading) {
    return <LoadingScreen />
  }

  // Auth gate: email verification + ToS
  if (auth.needsGate && auth.user && auth.profile) {
    const gateProfile = {
      accepted_terms_version: auth.profile.accepted_terms_version ?? null,
    }
    return (
      <Suspense fallback={null}>
        <LazyAuthGate
          user={auth.user}
          profile={gateProfile}
          onTermsAccepted={auth.handleTermsAccepted}
        >
          {null}
        </LazyAuthGate>
      </Suspense>
    )
  }

  // Profile-null fallback: profile trigger hasn't fired after all retries
  if (!auth.profile && auth.user) {
    return (
      <ProfileFallback
        error={auth.profileError}
        refreshProfile={auth.refreshProfile}
        onSignOut={async () => {
          const { signOut: doSignOut } = await import('../lib/auth')
          await doSignOut()
          navigate('/login')
        }}
      />
    )
  }

  // Signup wizard gate: blocks app until onboarding is complete
  if (auth.needsWizard) {
    return (
      <Suspense fallback={null}>
        <LazySignupWizard open onComplete={auth.handleWizardComplete} />
      </Suspense>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div style={shellStyle}>
      {/* Session revoked modal */}
      {auth.sessionRevoked && (
        <Suspense fallback={null}>
          <LazySessionRevokedModal open />
        </Suspense>
      )}

      {/* MFA setup prompt */}
      {auth.wizardDismissed && auth.hasMfaFactor === false && !auth.mfaPromptDismissed && (
        <Suspense fallback={null}>
          <LazyMfaSetupPrompt
            open
            onComplete={auth.dismissMfaPrompt}
            onSkip={auth.dismissMfaPrompt}
          />
        </Suspense>
      )}

      {/* First run modal */}
      {firstRunOpen && (
        <Suspense fallback={null}>
          <LazyFirstRunModal
            open
            onClose={() => {
              setFirstRunOpen(false)
              try {
                localStorage.setItem(ONBOARDED_KEY, '1')
              } catch {
                // ignore
              }
            }}
            onStartScratch={handleOpenScratch}
            onBrowseTemplates={handleOpenExplore}
            onImport={handleImport}
            onSelectTemplate={(id) => handleOpenProject(id)}
          />
        </Suspense>
      )}

      {/* New project modal (templates gallery) */}
      <NewProjectModal
        open={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
        onCreated={(id) => {
          setScratchMode(false)
          navigate(`/app/${id}`)
        }}
      />

      {/* Hidden import input */}
      <input
        ref={importRef}
        type="file"
        accept=".json,.chainsolvejson"
        style={{ display: 'none' }}
        onChange={handleImportFile}
      />

      {/* Toolbar */}
      <PanelErrorBoundary name="Toolbar">
        <WorkspaceToolbar
          plan={auth.plan}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={toggleSidebar}
          projectName={canvasControls?.projectName ?? null}
          canvasControls={canvasControls}
          projectId={projectId ?? null}
        />
      </PanelErrorBoundary>

      {/* Main content area */}
      <div style={mainStyle}>
        {/* Left sidebar */}
        <PanelErrorBoundary name="Sidebar">
          <LeftSidebar
            plan={auth.plan}
            onOpenProject={handleOpenProject}
            onNewProject={handleNewProject}
          />
        </PanelErrorBoundary>

        {/* Canvas area or welcome */}
        <div id="cs-main-content" style={canvasAreaStyle}>
          <PanelErrorBoundary name="Canvas">
            {showCanvas ? (
              <Suspense fallback={<LoadingScreen />}>
                <CanvasPage embedded onControlsReady={setCanvasControls} />
              </Suspense>
            ) : (
              <WelcomeCanvas
                onNewProject={handleNewProject}
                onOpenScratch={handleOpenScratch}
                onOpenExplore={handleOpenExplore}
                onImport={handleImport}
                onOpenProject={handleOpenProject}
              />
            )}
          </PanelErrorBoundary>
        </div>

        {/* Right sidebar (docked Inspector) — only when a canvas is active */}
        {showCanvas && <RightSidebar selectedNodeId={inspectedNodeId} />}
      </div>

      {/* Status bar */}
      <StatusBar />
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const shellStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  overflow: 'hidden',
}

const mainStyle: React.CSSProperties = {
  display: 'flex',
  flex: 1,
  minHeight: 0,
}

const canvasAreaStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
}

const profileFallbackStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100vh',
  gap: 12,
  fontFamily: "'Montserrat', system-ui, sans-serif",
  color: 'var(--text)',
  background: 'var(--bg)',
}

const refreshBtnStyle: React.CSSProperties = {
  padding: '0.5rem 1.5rem',
  border: '1px solid var(--border)',
  borderRadius: 6,
  background: 'var(--surface-2)',
  color: 'var(--text)',
  cursor: 'pointer',
  fontFamily: "'Montserrat', system-ui, sans-serif",
  fontSize: '0.85rem',
}

const profileErrorStyle: React.CSSProperties = {
  background: 'rgba(239,68,68,0.1)',
  border: '1px solid rgba(239,68,68,0.35)',
  color: '#f87171',
  borderRadius: 8,
  padding: '0.65rem 0.85rem',
  fontSize: '0.82rem',
  maxWidth: 480,
  wordBreak: 'break-word',
  lineHeight: 1.45,
}
