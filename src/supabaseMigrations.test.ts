/**
 * supabaseMigrations.test.ts — V2-007, V2-008, V2-009, V2-010
 *
 * Structural tests for Supabase migration SQL files.
 * - All SECURITY DEFINER functions must pin search_path (V2-007).
 * - Service-role-only tables must have explicit deny-all policies (V2-008).
 * - No duplicate permissive policies per table+action in baseline (V2-009).
 * - All foreign key columns have index coverage (V2-010).
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

// ── V2-009: No duplicate permissive policies per table+action in baseline ──

describe('Supabase baseline: no duplicate permissive policies per table+action (V2-009)', () => {
  const baseline = fs.readFileSync(path.join(MIGRATIONS_DIR, '0001_baseline_schema.sql'), 'utf-8')

  // Extract all CREATE POLICY statements: policy name, table, action
  const policyPattern =
    /CREATE POLICY\s+(\S+)\s+ON\s+public\.(\S+)\s+FOR\s+(SELECT|INSERT|UPDATE|DELETE|ALL)/gi
  const policies: Array<{ name: string; table: string; action: string }> = []
  let match: RegExpExecArray | null
  while ((match = policyPattern.exec(baseline)) !== null) {
    policies.push({ name: match[1], table: match[2], action: match[3].toUpperCase() })
  }

  // Tables that had the advisor warning — must have at most 1 policy per action
  const CHECKED_TABLES = [
    'marketplace_comments',
    'avatar_reports',
    'marketplace_install_events',
    'profiles',
    'user_reports',
  ] as const

  for (const table of CHECKED_TABLES) {
    it(`${table} has at most one policy per action`, () => {
      const tablePolicies = policies.filter((p) => p.table === table)
      const actionCounts = new Map<string, string[]>()
      for (const p of tablePolicies) {
        const actions = p.action === 'ALL' ? ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] : [p.action]
        for (const a of actions) {
          const existing = actionCounts.get(a) ?? []
          existing.push(p.name)
          actionCounts.set(a, existing)
        }
      }
      for (const [action, names] of actionCounts) {
        expect(
          names.length,
          `${table} has ${names.length} permissive policies for ${action}: ${names.join(', ')}`,
        ).toBeLessThanOrEqual(1)
      }
    })
  }
})

// ── V2-010: All FK columns have index coverage in baseline ─────────────

describe('Supabase baseline: all FK columns have index coverage (V2-010)', () => {
  const baseline = fs.readFileSync(path.join(MIGRATIONS_DIR, '0001_baseline_schema.sql'), 'utf-8')

  // Extract FK columns from inline column definitions
  const fkPattern = /^\s+(\w+)\s+\w+.*?REFERENCES\s+(?:public\.)?(\w+)\s*\(/gim
  const fks: Array<{ table: string; column: string }> = []

  // Determine which table each FK belongs to
  const tablePattern = /CREATE TABLE IF NOT EXISTS public\.(\w+)/gi
  const tableStarts: Array<{ table: string; pos: number }> = []
  let tm: RegExpExecArray | null
  while ((tm = tablePattern.exec(baseline)) !== null) {
    tableStarts.push({ table: tm[1], pos: tm.index })
  }

  let fm: RegExpExecArray | null
  while ((fm = fkPattern.exec(baseline)) !== null) {
    const pos = fm.index
    const line = fm[0]
    let table = 'unknown'
    for (const ts of tableStarts) {
      if (ts.pos <= pos) table = ts.table
      else break
    }
    // Skip primary key columns (auto-indexed by PK constraint)
    if (fm[1] === 'id' || /PRIMARY KEY/i.test(line)) continue
    fks.push({ table, column: fm[1] })
  }

  // Extract all index definitions — get table and leading column
  const idxPattern =
    /CREATE (?:UNIQUE )?INDEX IF NOT EXISTS \S+\s+ON public\.(\w+)(?:\s+USING \w+\s*)?\((\w+)/gi
  const indexedColumns = new Set<string>()
  let im: RegExpExecArray | null
  while ((im = idxPattern.exec(baseline)) !== null) {
    indexedColumns.add(`${im[1]}.${im[2]}`)
  }

  it('all FK columns are covered by an index (leading column)', () => {
    const missing: string[] = []
    for (const fk of fks) {
      const key = `${fk.table}.${fk.column}`
      if (!indexedColumns.has(key)) {
        missing.push(key)
      }
    }
    expect(missing, `FK columns without index coverage:\n  ${missing.join('\n  ')}`).toHaveLength(0)
  })

  it('V2-010 indexes are present', () => {
    const v2010Indexes = [
      'organizations.owner_id',
      'org_members.org_id',
      'org_members.user_id',
      'org_members.invited_by',
      'csp_reports.user_id',
      'marketplace_likes.user_id',
      'marketplace_likes.item_id',
      'avatar_reports.reporter_id',
      'avatar_reports.target_id',
      'avatar_reports.resolved_by',
      'ai_usage_monthly.org_id',
      'ai_request_log.org_id',
      'user_reports.reporter_id',
      'user_reports.resolved_by',
      'student_verifications.user_id',
    ]
    for (const key of v2010Indexes) {
      expect(indexedColumns.has(key), `${key} must have an index`).toBe(true)
    }
  })
})

// ── V2-011: Entitlement helpers align with TS plan hierarchy ───────────

describe('Supabase baseline: entitlement helpers cover all plan types (V2-011)', () => {
  const baseline = fs.readFileSync(path.join(MIGRATIONS_DIR, '0001_baseline_schema.sql'), 'utf-8')

  describe('user_has_active_plan', () => {
    // Extract the function body between CREATE...$$; markers
    const fnMatch = baseline.match(
      /CREATE OR REPLACE FUNCTION public\.user_has_active_plan\(uid uuid\)[\s\S]*?\$\$;/,
    )
    const fnBody = fnMatch?.[0] ?? ''

    it('checks is_developer', () => {
      expect(fnBody).toContain('is_developer')
    })

    it('checks is_admin', () => {
      expect(fnBody).toContain('is_admin')
    })

    it('checks is_student', () => {
      expect(fnBody).toContain('is_student')
    })

    it('includes enterprise plan', () => {
      expect(fnBody).toContain('enterprise')
    })

    it('includes trialing and pro', () => {
      expect(fnBody).toContain('trialing')
      expect(fnBody).toContain('pro')
    })
  })

  describe('enforce_project_limit', () => {
    const fnMatch = baseline.match(
      /CREATE OR REPLACE FUNCTION public\.enforce_project_limit\(\)[\s\S]*?\$\$;/,
    )
    const fnBody = fnMatch?.[0] ?? ''

    it('checks is_developer', () => {
      expect(fnBody).toContain('is_developer')
    })

    it('checks is_admin', () => {
      expect(fnBody).toContain('is_admin')
    })

    it('checks is_student', () => {
      expect(fnBody).toContain('is_student')
    })

    it('handles enterprise plan', () => {
      expect(fnBody).toContain('enterprise')
    })
  })

  describe('storage policies', () => {
    it('projects bucket uses user_can_write_projects', () => {
      expect(baseline).toContain('user_can_write_projects')
    })

    it('uploads bucket uses user_has_active_plan', () => {
      expect(baseline).toContain('user_has_active_plan')
    })

    it('buckets enforce folder = auth.uid() for path isolation', () => {
      const folderChecks = baseline.match(
        /foldername\(name\)\)\[1\]\s*=\s*\(select auth\.uid\(\)\)::text/g,
      )
      // At least 8 (4 per bucket for SELECT/INSERT/UPDATE/DELETE)
      expect((folderChecks ?? []).length).toBeGreaterThanOrEqual(8)
    })
  })
})
