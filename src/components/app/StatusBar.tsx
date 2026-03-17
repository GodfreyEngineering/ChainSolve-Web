/**
 * StatusBar — 22px fixed bar at the very bottom of the workspace (V3-2.1).
 *
 * Left:  engine status icon, node count, edge count
 * Right: zoom %, snap indicator, active sheet name, language code
 */

import { useTranslation } from 'react-i18next'
import { useStatusBarStore, type EngineStatus } from '../../stores/statusBarStore'
import { useCanvasesStore } from '../../stores/canvasesStore'
import { Circle, AlertCircle, Loader2, Grid3X3, FileSpreadsheet } from 'lucide-react'

function EngineStatusIcon({ status }: { status: EngineStatus }) {
  switch (status) {
    case 'computing':
      return <Loader2 size={12} className="statusbar-spin" aria-label="Computing" />
    case 'error':
      return <AlertCircle size={12} style={{ color: 'var(--danger)' }} aria-label="Error" />
    default:
      return <Circle size={10} style={{ color: 'var(--success)' }} aria-label="Idle" />
  }
}

export function StatusBar() {
  const { t, i18n } = useTranslation()
  const engineStatus = useStatusBarStore((s) => s.engineStatus)
  const blockCount = useStatusBarStore((s) => s.nodeCount)
  const chainCount = useStatusBarStore((s) => s.edgeCount)
  const zoomPercent = useStatusBarStore((s) => s.zoomPercent)
  const snapToGrid = useStatusBarStore((s) => s.snapToGrid)
  const isStale = useStatusBarStore((s) => s.isStale)
  const lastEvalMs = useStatusBarStore((s) => s.lastEvalMs)
  const lastEvalNodeCount = useStatusBarStore((s) => s.lastEvalNodeCount)
  const pendingPatchCount = useStatusBarStore((s) => s.pendingPatchCount)
  const evalMode = useStatusBarStore((s) => s.evalMode)

  const exportProgress = useStatusBarStore((s) => s.exportProgress)

  const canvases = useCanvasesStore((s) => s.canvases)
  const activeCanvasId = useCanvasesStore((s) => s.activeCanvasId)
  const activeSheetName = canvases.find((c) => c.id === activeCanvasId)?.name ?? null

  const langCode = (i18n.language ?? 'en').slice(0, 2).toUpperCase()

  const engineLabel =
    engineStatus === 'computing'
      ? t('statusBar.engineComputing')
      : engineStatus === 'error'
        ? t('statusBar.engineError')
        : isStale
          ? pendingPatchCount > 0
            ? `${pendingPatchCount} ${t('statusBar.pendingChanges', 'pending')}`
            : t('statusBar.stale', 'Stale')
          : lastEvalMs !== null
            ? `${lastEvalNodeCount} ${t('statusBar.blocks')} \u00B7 ${lastEvalMs} ms`
            : t('statusBar.engineIdle')

  return (
    <div className="statusbar" role="status" aria-live="polite">
      <div className="statusbar-left">
        <span className="statusbar-item" title={`Engine: ${engineLabel}`}>
          <EngineStatusIcon status={engineStatus} />
          <span style={{ marginLeft: 4, opacity: 0.8 }}>{engineLabel}</span>
        </span>
        <span className="statusbar-sep" aria-hidden="true" />
        <span className="statusbar-item">
          {blockCount} {t('statusBar.blocks')}
        </span>
        <span className="statusbar-sep" aria-hidden="true" />
        <span className="statusbar-item">
          {chainCount} {t('statusBar.chains')}
        </span>
        {evalMode !== 'auto' && (
          <>
            <span className="statusbar-sep" aria-hidden="true" />
            <span className="statusbar-item" style={{ opacity: 0.6, fontSize: '0.65rem' }}>
              {evalMode === 'manual'
                ? t('toolbar.manualMode', 'Manual')
                : t('statusBar.deferred', 'Deferred')}
            </span>
          </>
        )}
      </div>
      {exportProgress && (
        <div className="statusbar-center">
          <Loader2 size={12} className="statusbar-spin" />
          <span className="statusbar-item">{exportProgress}</span>
        </div>
      )}
      <div className="statusbar-right">
        <span className="statusbar-item">{zoomPercent}%</span>
        <span className="statusbar-sep" aria-hidden="true" />
        {snapToGrid && (
          <>
            <span className="statusbar-item" title={t('statusBar.snapToGrid')}>
              <Grid3X3 size={12} />
            </span>
            <span className="statusbar-sep" aria-hidden="true" />
          </>
        )}
        {activeSheetName && (
          <>
            <span className="statusbar-item" title={activeSheetName}>
              <FileSpreadsheet size={12} />
              <span className="statusbar-sheet-name">{activeSheetName}</span>
            </span>
            <span className="statusbar-sep" aria-hidden="true" />
          </>
        )}
        <span className="statusbar-item">{langCode}</span>
      </div>
    </div>
  )
}
