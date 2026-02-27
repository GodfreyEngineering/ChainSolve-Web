/**
 * exportAuditXlsxProject.ts — Generates and downloads a project-level
 * audit XLSX file containing all canvases.
 *
 * Uses the lazy-loaded write-excel-file (browser subpath) via xlsx-loader.ts.
 * The workbook is assembled from pure functions in xlsxModel.ts.
 */

import type { ProjectAuditModel } from '../pdf/auditModel'
import type { VariablesMap } from '../variables'
import type { TableExport } from './xlsxModel'
import { loadXlsx } from '../xlsx-loader'
import { buildProjectWorkbook } from './xlsxModel'
import { safeName, formatTimestampForFilename } from '../export-file-utils'

/**
 * Build and download a project-level audit .xlsx with all canvases.
 */
export async function exportAuditXlsxProject(
  model: ProjectAuditModel,
  variables: VariablesMap,
  tables: TableExport[],
): Promise<void> {
  const { writeXlsxFile } = await loadXlsx()
  const workbook = buildProjectWorkbook(model, variables, tables)

  const name = safeName(model.meta.projectName || 'ChainSolve')
  const ts = formatTimestampForFilename(model.meta.exportTimestamp)
  const fileName = `${name}_${ts}_project_audit.xlsx`

  await writeXlsxFile(workbook.sheets, {
    sheets: workbook.sheetNames,
    columns: workbook.columns,
    stickyRowsCount: 1,
    fileName,
  })
}
