/**
 * sqlQueryService.ts — 4.20: SQL query service layer.
 *
 * Executes parameterised SQL queries against the project's Supabase PostgreSQL
 * database and returns results as a DataTable-compatible structure.
 *
 * Layer boundary: components cannot import src/lib/supabase directly.
 * This module sits in src/lib/ and mediates all SQL execution.
 */

import { supabase } from './supabase'

export interface SqlQueryResult {
  columns: string[]
  rows: number[][]
  rowCount: number
  executionMs: number
  error?: string
}

/**
 * Run a read-only SQL query via Supabase's `rpc` mechanism.
 *
 * The query is executed via the `execute_sql_query` Postgres function which
 * runs with SECURITY DEFINER and enforces a read-only transaction. Parameters
 * are passed as positional $1, $2, … placeholders.
 *
 * Returns columns (string names) and rows (number[][] — non-numeric columns
 * are coerced to NaN). Only the first 10,000 rows are returned.
 *
 * Error handling: network or SQL errors surface as SqlQueryResult.error;
 * callers should display the message and treat columns/rows as empty.
 */
export async function runSqlQuery(
  sql: string,
  params: unknown[] = [],
): Promise<SqlQueryResult> {
  const t0 = performance.now()

  if (!sql.trim()) {
    return { columns: [], rows: [], rowCount: 0, executionMs: 0, error: 'Empty query' }
  }

  try {
    const { data, error } = await supabase.rpc('execute_sql_query', {
      p_sql: sql,
      p_params: params,
    })

    const executionMs = performance.now() - t0

    if (error) {
      return { columns: [], rows: [], rowCount: 0, executionMs, error: error.message }
    }

    // RPC returns { columns: string[], rows: unknown[][] }
    const result = data as { columns: string[]; rows: unknown[][] } | null
    if (!result || !Array.isArray(result.columns)) {
      return { columns: [], rows: [], rowCount: 0, executionMs }
    }

    const columns: string[] = result.columns
    const rows: number[][] = (result.rows ?? []).map((row) =>
      row.map((cell) => {
        const n = Number(cell)
        return Number.isFinite(n) ? n : NaN
      }),
    )

    return { columns, rows, rowCount: rows.length, executionMs }
  } catch (err) {
    const executionMs = performance.now() - t0
    const msg = err instanceof Error ? err.message : String(err)
    return { columns: [], rows: [], rowCount: 0, executionMs, error: msg }
  }
}
