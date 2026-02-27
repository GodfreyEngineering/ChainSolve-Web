/**
 * exportAuditXlsx.ts — Generates and downloads an audit XLSX file
 * for the active canvas sheet.
 *
 * Uses the lazy-loaded write-excel-file (browser subpath) via xlsx-loader.ts.
 * The workbook is assembled from pure functions in xlsxModel.ts.
 */

import type { AuditModel } from '../pdf/auditModel'
import type { VariablesMap } from '../variables'
import { loadXlsx } from '../xlsx-loader'
import { buildAuditWorkbook } from './xlsxModel'

/**
 * Build and download an audit .xlsx for a single canvas.
 */
export async function exportAuditXlsx(model: AuditModel, variables: VariablesMap): Promise<void> {
  const { writeXlsxFile } = await loadXlsx()
  const workbook = buildAuditWorkbook(model, variables)

  const safeName = (model.meta.projectName || 'ChainSolve').replace(/[^a-zA-Z0-9_-]/g, '_')
  const ts = model.meta.exportTimestamp.replace(/[:.]/g, '').replace('T', 'T').slice(0, 13)
  const fileName = `${safeName}_${ts}_audit.xlsx`

  await writeXlsxFile(workbook.sheets, {
    sheets: workbook.sheetNames,
    columns: workbook.columns,
    stickyRowsCount: 1,
    fileName,
  })
}
