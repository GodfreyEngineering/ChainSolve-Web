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

  const safeName = (model.meta.projectName || 'ChainSolve').replace(/[^a-zA-Z0-9_-]/g, '_')
  const ts = model.meta.exportTimestamp.replace(/[:.]/g, '').replace('T', 'T').slice(0, 13)
  const fileName = `${safeName}_${ts}_project_audit.xlsx`

  await writeXlsxFile(workbook.sheets, {
    sheets: workbook.sheetNames,
    columns: workbook.columns,
    stickyRowsCount: 1,
    fileName,
  })
}
