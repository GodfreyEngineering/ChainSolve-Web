# Enterprise Desktop Policy Hooks

**Status**: Architecture document — future work (post-Phase C)
**Relates to**: P121–P125 (org schema), P126–P129 (audit log)

---

## Overview

ChainSolve Desktop (future) will support a `policy.json` configuration file
that enterprise IT administrators can pre-deploy to managed devices. This
document defines the intended policy schema, enforcement model, and web-app
considerations for parity.

---

## policy.json Location

| Platform | Path |
|----------|------|
| macOS | `/Library/Application Support/ChainSolve/policy.json` |
| Windows | `%ProgramData%\ChainSolve\policy.json` |
| Linux | `/etc/chainsolve/policy.json` |

The Desktop app reads this file at startup. If missing, all defaults apply.
User-level settings (`~/...`) are always overridden by machine-level policy.

---

## Intended Policy Keys

```jsonc
{
  // ── Authentication ──────────────────────────────────────────────────────
  "sso": {
    // Force SSO-only login (disables email/password).
    "required": true,
    // OIDC provider URL (e.g. Okta, Azure AD, Google Workspace).
    "providerUrl": "https://login.company.com/oidc"
  },

  // ── Org enforcement ─────────────────────────────────────────────────────
  "org": {
    // If set, newly created projects are always assigned to this org ID.
    "defaultOrgId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    // Prevents users from creating personal (non-org) projects.
    "requireOrgProjects": false
  },

  // ── Data residency ──────────────────────────────────────────────────────
  "supabase": {
    // Override the Supabase project URL (for self-hosted / regional deployments).
    "url": "https://db.company-eu.supabase.co",
    "anonKey": "..."
  },

  // ── Audit log ───────────────────────────────────────────────────────────
  "auditLog": {
    // Force audit log enabled (users cannot disable it).
    "forceEnabled": true,
    // Retention override in days (admin-specified, within plan limits).
    "retentionDays": 365
  },

  // ── Feature flags ───────────────────────────────────────────────────────
  "features": {
    // Disable the public Marketplace for managed users.
    "explore": false,
    // Disable CSV import/export.
    "csvImport": true,
    // Allow or block external sharing of project exports.
    "exportSharing": false
  },

  // ── Telemetry ───────────────────────────────────────────────────────────
  "telemetry": {
    // Opt all managed users into telemetry (or force opt-out).
    "enabled": false
  }
}
```

---

## Enforcement Model

1. **Desktop reads** `policy.json` at startup before any React code runs.
2. Policy values are injected as read-only environment variables / build-time
   feature flags — they cannot be overridden by the user via Settings.
3. The **web app** (browser) does NOT read `policy.json`; it relies on
   server-side RLS and org-level settings for equivalent enforcement.
4. For web parity, org admins can configure equivalent restrictions via the
   Org Settings UI (future) which are stored in `organizations.policy jsonb`.

---

## Web App Parity (organizations.policy)

A future migration will add `policy jsonb NOT NULL DEFAULT '{}'` to the
`organizations` table. The service layer will merge org policy with user
settings at read time:

```ts
// Pseudocode — future work
const effectivePolicy = mergePolicy(orgPolicy, userSettings)
```

Keys supported in `organizations.policy` (subset of `policy.json`):

| Key | Type | Description |
|-----|------|-------------|
| `features.explore` | boolean | Enable/disable Explore for org members |
| `auditLog.forceEnabled` | boolean | Force audit log on for all org members |
| `auditLog.retentionDays` | number | Override default retention for org events |

---

## Security Considerations

- `policy.json` is **read-only at runtime** — the Desktop app must not write
  back to it (it belongs to IT admin, not the user process).
- `anonKey` in `policy.json` is a Supabase anon key (public, protected by RLS)
  — it is not a secret, but should still not be logged or exported.
- `sso.providerUrl` must be validated against an allowlist before redirect
  to prevent open-redirect attacks.
- The `organizations.policy` jsonb column must be guarded by RLS so only
  org owners/admins can write it.

---

## Implementation Roadmap

| Phase | Item | Description |
|-------|------|-------------|
| Post-C | EXTRA-001 | Desktop: read `policy.json` at startup |
| Post-C | EXTRA-002 | Desktop: enforce `sso.required` login gate |
| Post-C | EXTRA-003 | Migration: add `policy jsonb` to `organizations` |
| Post-C | EXTRA-004 | Org Settings UI: configure web-parity policy keys |

---

*Last updated: 2026-02-28*
