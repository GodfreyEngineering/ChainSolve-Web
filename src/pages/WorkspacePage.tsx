/**
 * WorkspacePage — unified single-page workspace (V3-UI Phase 5).
 *
 * Composes:
 *   - WorkspaceToolbar (36px top bar)
 *   - LeftSidebar (collapsible, 320px default)
 *   - Main area: CanvasPage (when projectId present) or WelcomeCanvas (empty state)
 *
 * Auth flow:
 *   1. Loading → LoadingScreen
 *   2. Needs gate (email verify / ToS) → AuthGate
 *   3. Needs signup wizard → SignupWizard
 *   4. Needs MFA prompt → MfaSetupPrompt
 *   5. First run → FirstRunModal
 *   6. Normal workspace view
 */

import { lazy, Suspense, useCallback, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useWorkspaceAuth } from '../hooks/useWorkspaceAuth'
import { WorkspaceToolbar } from '../components/app/WorkspaceToolbar'
import { LeftSidebar } from '../components/app/LeftSidebar'
import { WelcomeCanvas } from '../components/canvas/WelcomeCanvas'
import { LoadingScreen } from '../components/ui/LoadingScreen'
import { useSidebarStore } from '../stores/sidebarStore'
import { importProject, type ProjectJSON } from '../lib/projects'

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

export default function WorkspacePage() {
  const { projectId } = useParams<{ projectId?: string }>()
  const navigate = useNavigate()
  const auth = useWorkspaceAuth()
  const { open: sidebarOpen, toggle: toggleSidebar, setActiveTab } = useSidebarStore()
  const importRef = useRef<HTMLInputElement>(null)

  const [firstRunOpen, setFirstRunOpen] = useState(() => {
    try {
      return !localStorage.getItem(ONBOARDED_KEY)
    } catch {
      return false
    }
  })

  const handleOpenProject = useCallback(
    (id: string) => {
      navigate(`/app/${id}`)
    },
    [navigate],
  )

  const handleNewProject = useCallback(() => {
    navigate('/canvas')
  }, [navigate])

  const handleOpenScratch = useCallback(() => {
    navigate('/canvas')
  }, [navigate])

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
        if (result?.id) navigate(`/app/${result.id}`)
      } catch {
        // Import error
      }
      if (importRef.current) importRef.current.value = ''
    },
    [navigate],
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

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div style={shellStyle}>
      {/* Session revoked modal */}
      {auth.sessionRevoked && (
        <Suspense fallback={null}>
          <LazySessionRevokedModal open />
        </Suspense>
      )}

      {/* Signup wizard */}
      {auth.needsWizard && (
        <Suspense fallback={null}>
          <LazySignupWizard open onComplete={auth.handleWizardComplete} />
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

      {/* Hidden import input */}
      <input
        ref={importRef}
        type="file"
        accept=".json,.chainsolvejson"
        style={{ display: 'none' }}
        onChange={handleImportFile}
      />

      {/* Toolbar */}
      <WorkspaceToolbar
        plan={auth.plan}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={toggleSidebar}
        projectName={null}
      />

      {/* Main content area */}
      <div style={mainStyle}>
        {/* Left sidebar */}
        <LeftSidebar
          plan={auth.plan}
          onOpenProject={handleOpenProject}
          onNewProject={handleNewProject}
        />

        {/* Canvas area or welcome */}
        <div style={canvasAreaStyle}>
          {projectId ? (
            <Suspense fallback={<LoadingScreen />}>
              <CanvasPage />
            </Suspense>
          ) : (
            <WelcomeCanvas
              onNewProject={handleNewProject}
              onOpenScratch={handleOpenScratch}
              onOpenExplore={handleOpenExplore}
              onImport={handleImport}
            />
          )}
        </div>
      </div>
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
