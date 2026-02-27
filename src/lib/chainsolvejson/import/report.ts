/**
 * report.ts — Import report for .chainsolvejson import.
 *
 * Captures validation results, planned operations, and any errors
 * for download by the user.
 */

import type { ImportError } from './validate'
import type { ChainsolveJsonV1 } from '../model'

// ── Report types ────────────────────────────────────────────────────────────

export interface ImportReport {
  timestamp: string
  fileName: string
  fileMeta: {
    format: string
    version: number
    exportedAt: string
    exporterVersion: string
    projectName: string
  }
  counts: {
    canvases: number
    variables: number
    embeddedAssets: number
    referencedAssets: number
    totalEmbeddedBytes: number
  }
  validation: {
    passed: boolean
    errors: ImportError[]
    warnings: ImportError[]
  }
  operations: {
    projectCreated: boolean
    newProjectId: string | null
    canvasesImported: number
    assetsUploaded: number
    unreferencedAssets: string[]
  }
  canvasIdRemap: Record<string, string>
}

// ── Summary extraction (pre-import) ─────────────────────────────────────────

export interface ImportSummary {
  projectName: string
  canvasCount: number
  variableCount: number
  embeddedAssetCount: number
  referencedAssetCount: number
  totalEmbeddedBytes: number
  exportedAt: string
  exporterVersion: string
}

export function extractImportSummary(model: ChainsolveJsonV1): ImportSummary {
  let totalEmbeddedBytes = 0
  let embeddedCount = 0
  let referencedCount = 0

  for (const a of model.assets) {
    if (a.encoding === 'base64') {
      embeddedCount++
      totalEmbeddedBytes += a.sizeBytes
    } else {
      referencedCount++
    }
  }

  return {
    projectName: model.project.name,
    canvasCount: model.canvases.length,
    variableCount: Object.keys(model.project.variables).length,
    embeddedAssetCount: embeddedCount,
    referencedAssetCount: referencedCount,
    totalEmbeddedBytes,
    exportedAt: model.exportedAt,
    exporterVersion: model.exporter.appVersion,
  }
}

// ── Report builder ──────────────────────────────────────────────────────────

export function buildImportReport(
  fileName: string,
  model: ChainsolveJsonV1,
  validation: { passed: boolean; errors: ImportError[]; warnings: ImportError[] },
  operations: {
    projectCreated: boolean
    newProjectId: string | null
    canvasesImported: number
    assetsUploaded: number
    unreferencedAssets: string[]
  },
  canvasIdRemap: Record<string, string>,
): ImportReport {
  const summary = extractImportSummary(model)
  return {
    timestamp: new Date().toISOString(),
    fileName,
    fileMeta: {
      format: model.format,
      version: model.version,
      exportedAt: model.exportedAt,
      exporterVersion: model.exporter.appVersion,
      projectName: model.project.name,
    },
    counts: {
      canvases: summary.canvasCount,
      variables: summary.variableCount,
      embeddedAssets: summary.embeddedAssetCount,
      referencedAssets: summary.referencedAssetCount,
      totalEmbeddedBytes: summary.totalEmbeddedBytes,
    },
    validation,
    operations,
    canvasIdRemap,
  }
}

// ── Report download ─────────────────────────────────────────────────────────

export function downloadImportReport(report: ImportReport): void {
  const json = JSON.stringify(report, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `import-report_${report.timestamp.replace(/[:.]/g, '').slice(0, 15)}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
