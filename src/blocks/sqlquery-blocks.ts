/**
 * sqlquery-blocks.ts — 4.20: SQL query block definition.
 *
 * The SqlQuery block lets users write parameterised PostgreSQL queries against
 * their Supabase project. Results are output as a DataTable (same shape as
 * tableInput) which can flow into table-ops, plots, and ML blocks.
 *
 * Bridge: blockType='sqlQuery' → 'tableInput' so the Rust engine treats the
 * result as a standard table source. No new Rust op required.
 */

import type { BlockDef } from './registry'

export function registerSqlQueryBlocks(register: (def: BlockDef) => void): void {
  register({
    type: 'sqlQuery',
    label: 'SQL Query',
    category: 'data',
    nodeKind: 'csSqlQuery',
    inputs: [],
    proOnly: true,
    defaultData: {
      blockType: 'sqlQuery',
      label: 'SQL Query',
      /** The SQL statement. Use $1, $2, … for parameter placeholders. */
      sql: 'SELECT * FROM your_table LIMIT 100',
      /** Ordered parameter values for $1, $2, … placeholders. */
      params: [] as string[],
      /** Last fetched result cached here for serialisation. */
      tableData: { columns: [] as string[], rows: [] as number[][] },
      /** Whether to run the query automatically when sql/params change. */
      autoRun: false,
      /** Number of rows returned in last run. */
      rowCount: 0,
      /** Execution time in ms for last run. */
      executionMs: 0,
      /** Last error message (empty string if none). */
      queryError: '',
    },
    synonyms: ['sql', 'database', 'query', 'postgres', 'postgresql', 'supabase', 'db', 'select'],
    tags: ['data', 'database', 'sql', 'query'],
    description:
      'Execute parameterised PostgreSQL queries via Supabase. Write SELECT statements with $1/$2 parameters. Results flow as a DataTable into plots and table operations.',
  })
}
