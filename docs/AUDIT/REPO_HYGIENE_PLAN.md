# ChainSolve Web — Repo Hygiene Plan

Generated: 2026-03-02
Based on: [REPO_AUDIT_REPORT.md](./REPO_AUDIT_REPORT.md)

This plan enumerates the cleanup tasks identified by the F0-1 audit,
grouped by priority and risk. Each item specifies which files will be
modified, created, or removed.

---

## Priority 1 — Fix Stale Documentation References

These are factual errors that could mislead during deployment.

### 1a. Fix CSP endpoint reference in SETUP.md

- **File**: `docs/SETUP.md` (~line 70)
- **Change**: Replace `/api/security/csp-report` with `/api/report/csp`
- **Risk**: None (docs only)

### 1b. Fix CSP endpoint reference in ARCHITECTURE.md

- **File**: `docs/ARCHITECTURE.md` (~line 85)
- **Change**: Replace `/api/security/csp-report` with `/api/report/csp`
- **Risk**: None (docs only)

### 1c. Fix migration attribution in RELEASE.md

- **File**: `docs/RELEASE.md` (line 28)
- **Change**: Change "0012" to "0013" for `observability_events` table origin
- **Risk**: None (docs only)

---

## Priority 2 — Consolidate Duplicated Utilities

### 2a. Consolidate SHA-256 implementations in src/

Three identical `crypto.subtle.digest('SHA-256', ...)` wrappers exist:

| Current Location | Function | Accepts |
|---|---|---|
| `src/lib/pdf/sha256.ts` | `sha256Hex(text)` | string |
| `src/lib/chainsolvejson/hashes.ts` | `sha256BytesHex(bytes)` | Uint8Array |
| `src/observability/redact.ts` | `hashString(input)` | string |

**Plan**:
- Keep `src/lib/pdf/sha256.ts` as the canonical string-to-hex implementation
- Make `src/observability/redact.ts:hashString()` re-export or alias `sha256Hex`
- Keep `sha256BytesHex()` in `hashes.ts` (different input type) but import core logic from sha256.ts
- **Files modified**: `src/observability/redact.ts`, `src/lib/chainsolvejson/hashes.ts`
- **Files removed**: None
- **Risk**: Low — update imports, run tests

### 2b. Consolidate str() and sha256() in functions/

Three copies of `str(v, max)` and `sha256(input)` in serverless functions:

| Location |
|---|
| `functions/api/report/client.ts` |
| `functions/api/report/csp.ts` |
| `functions/api/security/csp-report.ts` |

**Plan**:
- Move `str()` and `sha256()` into `functions/api/_lib.ts` (already has `jsonError()`)
- Update the three files to import from `_lib.ts`
- **Files modified**: `functions/api/_lib.ts`, `functions/api/report/client.ts`, `functions/api/report/csp.ts`, `functions/api/security/csp-report.ts`
- **Risk**: Low — pure refactor, same runtime behavior

### 2c. Extract JWT authentication helper in Stripe handlers

The ~8-line Bearer token extraction + `supabaseAdmin.auth.getUser(token)` pattern
is repeated in 4 Stripe handlers.

**Plan**:
- Add `authenticateRequest(request, env)` to `functions/api/stripe/_lib.ts`
- Update 4 handlers to use it: `create-checkout-session.ts`, `create-portal-session.ts`, `marketplace-checkout.ts`, `connect-onboarding.ts`
- **Files modified**: `functions/api/stripe/_lib.ts` + 4 handlers
- **Risk**: Low — same auth logic, just extracted

---

## Priority 3 — Document Undocumented Features

### 3a. Document user session management

- **Feature**: Device session tracking (migration 0046, `src/lib/sessionService.ts`)
- **Action**: Add section to `docs/SECURITY.md` or create `docs/USER_SESSIONS.md`
- **Files created/modified**: 1 doc file
- **Risk**: None

### 3b. Document comment rate limiting

- **Feature**: Marketplace comment rate limiting (migration 0043)
- **Action**: Add section to `docs/ARCHITECTURE.md` marketplace section
- **Files modified**: `docs/ARCHITECTURE.md`
- **Risk**: None

### 3c. Document avatar reports

- **Feature**: Avatar reporting (migration 0039)
- **Action**: Add section to `docs/ARCHITECTURE.md` moderation section
- **Files modified**: `docs/ARCHITECTURE.md`
- **Risk**: None

---

## Priority 4 — Deprecate Legacy Endpoint

### 4a. Mark legacy CSP endpoint as deprecated

- **File**: `functions/api/security/csp-report.ts`
- **Action**: Add deprecation header comment and `X-Deprecated` response header
- **Removal timeline**: After confirming zero traffic (check observability_events)
- **Risk**: None — backward-compatible change
- **Note**: Do NOT remove yet — existing clients may still POST here

---

## Priority 5 — Optional Improvements (Low Priority)

### 5a. Centralize localStorage key definitions

Currently 28 `cs:*` keys are defined in 15 modules. No duplicates exist — keys
are co-located with their usage. Centralizing would improve discoverability.

- **Action**: Create `src/lib/storageKeys.ts` exporting all key constants
- **Files created**: 1 new file
- **Files modified**: ~15 modules (update imports)
- **Risk**: Medium (many files touched) — defer until a natural refactor opportunity

### 5b. Refactor pages to use service layer

5 pages import Supabase directly (known adapter boundary violations):
- `src/pages/AppShell.tsx`
- `src/pages/CanvasPage.tsx`
- `src/pages/Settings.tsx`
- `src/pages/settings/BillingSettings.tsx`

- **Action**: Extract Supabase calls into `src/lib/` service functions
- **Files modified**: 4-5 pages + new service functions
- **Risk**: Medium — requires careful testing of auth/data flows

### 5c. Split large AI function

`functions/api/ai.ts` is 672 LOC — the largest serverless function.

- **Action**: Extract task dispatch, quota enforcement, and enterprise policy into sub-modules
- **Risk**: Low — internal refactor within functions/

---

## Files Summary

### Will Be Modified

| File | Priority | Change Type |
|---|---|---|
| `docs/SETUP.md` | P1 | Fix stale CSP endpoint ref |
| `docs/ARCHITECTURE.md` | P1 | Fix stale CSP endpoint ref + add feature docs |
| `docs/RELEASE.md` | P1 | Fix migration attribution |
| `src/observability/redact.ts` | P2 | Replace hashString with sha256Hex import |
| `src/lib/chainsolvejson/hashes.ts` | P2 | Import SHA-256 core from pdf/sha256.ts |
| `functions/api/_lib.ts` | P2 | Add str() and sha256() helpers |
| `functions/api/report/client.ts` | P2 | Import str/sha256 from _lib |
| `functions/api/report/csp.ts` | P2 | Import str/sha256 from _lib |
| `functions/api/security/csp-report.ts` | P2+P4 | Import str/sha256 + deprecation marker |
| `functions/api/stripe/_lib.ts` | P2 | Add authenticateRequest() |
| `functions/api/stripe/create-checkout-session.ts` | P2 | Use authenticateRequest() |
| `functions/api/stripe/create-portal-session.ts` | P2 | Use authenticateRequest() |
| `functions/api/stripe/marketplace-checkout.ts` | P2 | Use authenticateRequest() |
| `functions/api/stripe/connect-onboarding.ts` | P2 | Use authenticateRequest() |
| `docs/SECURITY.md` | P3 | Add session management section |

### Will Be Created

| File | Priority | Purpose |
|---|---|---|
| (none required — all changes are modifications) | | |

### Will Be Removed / Quarantined

| File | Priority | Reason |
|---|---|---|
| `functions/api/security/csp-report.ts` | P4 (future) | Deprecated — remove after zero-traffic confirmation |

---

## Execution Order

1. **P1** (docs fixes) — safe, zero-risk, immediate value
2. **P2a** (SHA-256 consolidation in src/) — cleanest duplication win
3. **P2b** (str/sha256 in functions/) — second duplication win
4. **P2c** (JWT auth helper) — third duplication win
5. **P3** (feature documentation) — fill doc gaps
6. **P4** (deprecation marker) — preparatory
7. **P5** (optional) — as opportunities arise

Each step is independently committable and testable.
