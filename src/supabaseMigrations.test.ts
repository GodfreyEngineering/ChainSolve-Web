/**
 * supabaseMigrations.test.ts — V2-007, V2-008
 *
 * Structural tests for Supabase migration SQL files.
 * - All SECURITY DEFINER functions must pin search_path (V2-007).
 * - Service-role-only tables must have explicit deny-all policies (V2-008).
 */

import { describe, it, expect } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'supabase', 'migrations')

const migrationFiles = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort()

describe('Supabase migrations: SECURITY DEFINER functions must SET search_path', () => {
  for (const file of migrationFiles) {
    it(`${file} — no SECURITY DEFINER without SET search_path`, () => {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8')

      // Find all SECURITY DEFINER occurrences
      const lines = sql.split('\n')
      const definerLines: number[] = []
      for (let i = 0; i < lines.length; i++) {
        if (/SECURITY\s+DEFINER/i.test(lines[i]) && !lines[i].trimStart().startsWith('--')) {
          definerLines.push(i)
        }
      }

      for (const lineIdx of definerLines) {
        const line = lines[lineIdx]
        // The SET search_path clause must appear on the same line as SECURITY DEFINER
        // (standard PostgreSQL CREATE FUNCTION syntax puts it before AS $$)
        expect(
          /SET\s+search_path\s*=/i.test(line),
          `${file}:${lineIdx + 1} has SECURITY DEFINER without SET search_path:\n  ${line.trim()}`,
        ).toBe(true)
      }
    })
  }

  it('all 5 flagged functions are present in baseline with SET search_path', () => {
    const baseline = fs.readFileSync(path.join(MIGRATIONS_DIR, '0001_baseline_schema.sql'), 'utf-8')
    const functions = [
      'handle_canvases_updated_at',
      'enforce_comment_rate_limit',
      'enforce_org_install_policy',
      'enforce_org_comment_policy',
      'cleanup_expired_audit_logs',
    ]
    for (const fn of functions) {
      const pattern = new RegExp(
        `CREATE OR REPLACE FUNCTION public\\.${fn}\\(\\)[^$]*SET\\s+search_path\\s*=\\s*public`,
        's',
      )
      expect(pattern.test(baseline), `${fn} must have SET search_path = public`).toBe(true)
    }
  })
})

// ── V2-008: Service-role-only tables must have deny-all policies ─────────

describe('Supabase baseline: service-role-only tables have deny-all policies', () => {
  const baseline = fs.readFileSync(path.join(MIGRATIONS_DIR, '0001_baseline_schema.sql'), 'utf-8')

  const SERVICE_TABLES = ['observability_events', 'stripe_events'] as const

  for (const table of SERVICE_TABLES) {
    it(`${table} has deny-all policy in baseline`, () => {
      const pattern = new RegExp(
        `CREATE POLICY \\S+ ON public\\.${table}\\s+FOR ALL TO authenticated\\s+USING \\(false\\) WITH CHECK \\(false\\)`,
        's',
      )
      expect(pattern.test(baseline), `${table} must have a deny-all policy`).toBe(true)
    })
  }
})
