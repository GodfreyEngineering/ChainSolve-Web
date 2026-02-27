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
import { safeName, formatTimestampForFilename } from '../export-file-utils'

/**
 * Build and download an audit .xlsx for a single canvas.
 */
export async function exportAuditXlsx(model: AuditModel, variables: VariablesMap): Promise<void> {
  const { writeXlsxFile } = await loadXlsx()
  const workbook = buildAuditWorkbook(model, variables)

  const name = safeName(model.meta.projectName || 'ChainSolve')
  const ts = formatTimestampForFilename(model.meta.exportTimestamp)
  const fileName = `${name}_${ts}_audit.xlsx`

  await writeXlsxFile(workbook.sheets, {
    sheets: workbook.sheetNames,
    columns: workbook.columns,
    stickyRowsCount: 1,
    fileName,
  })
}
