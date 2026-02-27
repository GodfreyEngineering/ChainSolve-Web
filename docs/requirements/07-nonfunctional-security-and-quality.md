# 07 — Non-Functional, Security & Quality Requirements

> Revision: 1.0 · Date: 2026-02-26

This document covers cross-cutting requirements that apply to all ChainSolve
platforms: Web, Mobile, and Desktop.

---

## 1. Security

### 1.1 Authentication & session management

| ID | Requirement | Priority |
|----|-------------|----------|
| SEC-1 | Authentication MUST use Supabase Auth (JWTs). Tokens MUST be stored securely (httpOnly cookies or secure browser storage). | MUST |
| SEC-2 | JWT refresh MUST happen automatically before expiry. A failed refresh MUST redirect to login. | MUST |
| SEC-3 | Session tokens MUST NOT appear in URLs, logs, error messages, or debug console exports. | MUST |
| SEC-4 | Billing-sensitive operations (plan changes, payment method updates) MUST require password re-authentication with a 10-minute window. | MUST |
| SEC-5 | After 30 days of inactivity, the session MUST expire and require re-authentication. | SHOULD |
| SEC-6 | Desktop offline mode MUST use a local authentication mechanism (password or OS keychain) to protect encrypted project data. | MUST |

### 1.2 Row-Level Security (RLS)

| ID | Requirement | Priority |
|----|-------------|----------|
| RLS-1 | All user-facing Supabase tables MUST have RLS enabled. | MUST |
| RLS-2 | RLS policies MUST use the canonical `(select auth.uid())` pattern for consistency and query planner optimization. | MUST |
| RLS-3 | All policies MUST scope to `owner_id = (select auth.uid())`. | MUST |
| RLS-4 | `SELECT`, `INSERT`, `UPDATE`, and `DELETE` MUST each have explicit policies (no `ALL` shortcuts). | MUST |
| RLS-5 | The `INSERT` policy MUST enforce that `owner_id` matches `auth.uid()` (prevent inserting rows for other users). | MUST |
| RLS-6 | Future org-scoped policies MUST check org membership via a subquery, not a denormalized field. | SHOULD |

### 1.3 Storage ACLs

| ID | Requirement | Priority |
|----|-------------|----------|
| STOR-1 | Storage bucket RLS policies MUST enforce that the path prefix matches `auth.uid()`. | MUST |
| STOR-2 | Users MUST NOT be able to read or write files outside their own `{userId}/` prefix. | MUST |
| STOR-3 | Path components MUST be validated for traversal attacks (`..`, URL encoding bypasses). | MUST |
| STOR-4 | Uploaded files MUST be scanned for MIME type consistency (e.g. a `.csv` file should be `text/csv` or `text/plain`). | SHOULD |

### 1.4 Content Security Policy (CSP)

| ID | Requirement | Priority |
|----|-------------|----------|
| CSP-1 | The web app MUST serve a strict CSP header that allows: `'self'` for scripts, `'wasm-unsafe-eval'` for WASM, Supabase domains for API calls, and Vega-Lite for chart rendering. | MUST |
| CSP-2 | `'unsafe-eval'` MUST NOT be used. Only `'wasm-unsafe-eval'` is permitted. | MUST |
| CSP-3 | `'unsafe-inline'` MUST NOT be used for scripts. Styles MAY use `'unsafe-inline'` only if no nonce-based alternative is feasible. | MUST |
| CSP-4 | CSP violations MUST be reported to the `csp_reports` table via `report-uri` (public endpoint, no auth required). | SHOULD |
| CSP-5 | Desktop WebView MUST apply an equivalent CSP. | MUST |

### 1.5 Input validation

| ID | Requirement | Priority |
|----|-------------|----------|
| IV-1 | All user inputs MUST be validated at the system boundary (form submission, API call, file import). | MUST |
| IV-2 | Numeric inputs MUST reject `NaN`, `Infinity`, `-Infinity`, and non-numeric strings. | MUST |
| IV-3 | Project names MUST be sanitized (≤ 200 chars, no control characters). | MUST |
| IV-4 | Variable names MUST be sanitized (≤ 100 chars, no control characters, alphanumeric + underscore recommended). | MUST |
| IV-5 | CSV import MUST validate cell content (numeric-only for data cells). Non-numeric cells MUST be flagged. | MUST |
| IV-6 | JSON payloads (project JSON, variables JSONB) MUST be validated against expected shapes before persistence. | MUST |
| IV-7 | File uploads MUST be size-limited (see Storage requirements). Oversized files MUST be rejected with a clear message. | MUST |

### 1.6 Threat model (lite)

| Threat | Risk | Mitigation |
|--------|------|-----------|
| **Unauthorized data access** | High | RLS on all tables; storage path enforcement; JWT auth. |
| **XSS** | Medium | Strict CSP; React's default escaping; no `dangerouslySetInnerHTML` without sanitization. |
| **CSRF** | Low | Supabase JWT auth (not cookie-based session). |
| **WASM code injection** | Low | `'wasm-unsafe-eval'` limits WASM to same-origin modules. No user-uploaded WASM. |
| **Data exfiltration (desktop)** | Medium (enterprise) | Encrypted local storage; airgapped mode; no external calls. |
| **Credential theft** | Medium | OS keychain for desktop; httpOnly storage for web; re-auth for billing. |
| **Supply chain (NPM/Cargo)** | Medium | Lockfiles pinned; Dependabot alerts; CI builds from lockfile. |
| **DoS via large graph** | Low | Watchdog timeout (5 s); bounded ring buffer; downsampling for plots. |

---

## 2. Privacy

| ID | Requirement | Priority |
|----|-------------|----------|
| PV-1 | Telemetry and analytics MUST be **opt-in**. The default MUST be no telemetry. | MUST |
| PV-2 | When telemetry is enabled, it MUST collect only: anonymized usage events (feature usage counts), performance metrics, and error reports. | MUST |
| PV-3 | Telemetry MUST NOT collect: project content, variable values, node labels, file contents, or any PII beyond a hashed user ID. | MUST |
| PV-4 | The debug console export MUST redact auth tokens, API keys, and email addresses. | MUST |
| PV-5 | A privacy policy MUST be accessible from the login page, settings page, and app store listings. | MUST |
| PV-6 | Users MUST be able to request data deletion (account + all projects) via settings or a documented process. | MUST |
| PV-7 | The enterprise/desktop build MUST support a policy flag to disable all telemetry unconditionally. | MUST |
| PV-8 | Third-party scripts (analytics, error tracking) MUST NOT be loaded unless the user has opted in. | MUST |

---

## 3. Reliability

### 3.1 Engine determinism

| ID | Requirement | Priority |
|----|-------------|----------|
| RE-1 | The Rust/WASM engine MUST produce **identical results** for identical inputs on all platforms (Web, Mobile, Desktop). | MUST |
| RE-2 | Floating-point operations MUST use IEEE 754 double precision consistently. Platform-specific rounding differences MUST NOT occur. | MUST |
| RE-3 | The engine MUST NOT use random number generators, system clocks, or any non-deterministic data source in evaluation. | MUST |
| RE-4 | Golden test fixtures (known input → expected output) MUST be maintained and run in CI. | MUST |
| RE-5 | `NaN` MUST never be a valid output. Any operation that would produce `NaN` MUST instead produce `Value::error(message)`. | MUST |

### 3.2 Crash safety

| ID | Requirement | Priority |
|----|-------------|----------|
| CS-1 | WASM panics MUST be caught by the JavaScript wrapper and surfaced as error diagnostics, not app crashes. | MUST |
| CS-2 | The Web Worker running WASM MUST have a watchdog timer (5 000 ms). If the worker doesn't respond within the timeout, it MUST be terminated and a new worker spawned. | MUST |
| CS-3 | Auto-save MUST run on a debounced interval (e.g. every 5 seconds when dirty). A crash after editing MUST lose at most 5 seconds of work. | MUST |
| CS-4 | The app MUST handle Supabase connectivity loss gracefully: show a "connection lost" indicator and queue saves for retry. | MUST |
| CS-5 | Desktop: project file writes MUST use atomic write (write to temp file → rename) to prevent corruption on crash. | MUST |

### 3.3 Data integrity

| ID | Requirement | Priority |
|----|-------------|----------|
| DI-1 | Conflict detection MUST prevent silent overwrites when two sessions edit the same project. | MUST |
| DI-2 | Schema version mismatches MUST be handled gracefully (auto-migrate upward; reject downgrade). | MUST |
| DI-3 | Canvas JSON MUST be validated on load. If validation fails, the original file MUST be preserved and the error surfaced to the user. | MUST |

---

## 4. Accessibility

### 4.1 General

| ID | Requirement | Priority |
|----|-------------|----------|
| A11Y-1 | The app SHOULD target **WCAG 2.1 Level AA** compliance for all core workflows (project management, block library, inspector, variable editing, debug console). | SHOULD |
| A11Y-2 | The canvas graph interaction is inherently visual and challenging for full screen-reader accessibility. The app MUST provide **keyboard-navigable alternatives** for all canvas operations (e.g. keyboard shortcuts, command palette). | MUST |
| A11Y-3 | All interactive elements outside the canvas MUST be keyboard-navigable (Tab, Enter, Space, Arrow keys). | MUST |

### 4.2 Keyboard navigation

| ID | Requirement | Priority |
|----|-------------|----------|
| KB-1 | Tab order MUST follow a logical reading order (header → sheets bar → sidebar → canvas → inspector → console). | MUST |
| KB-2 | Focus indicators MUST be clearly visible on all interactive elements. | MUST |
| KB-3 | Modal dialogs MUST trap focus. Escape MUST close modals. | MUST |
| KB-4 | The menu bar MUST support arrow-key navigation (`role="menubar"` / `role="menu"`). | MUST |
| KB-5 | The Command Palette MUST support arrow-key navigation and Enter-to-execute. | MUST |
| KB-6 | Canvas shortcuts (Ctrl+Z, Ctrl+C, etc.) MUST NOT fire when focus is inside a text input. | MUST |

### 4.3 Visual accessibility

| ID | Requirement | Priority |
|----|-------------|----------|
| VA-1 | Color MUST NOT be the sole indicator of state. Combine with icons, text, borders, or patterns. | MUST |
| VA-2 | Text contrast ratios MUST meet WCAG AA minimums (4.5:1 for normal text, 3:1 for large text) in both light and dark themes. | MUST |
| VA-3 | The app MUST respect `prefers-reduced-motion`: disable animated edges, CSS transitions, and any auto-playing animations. | MUST |
| VA-4 | The app SHOULD respect `prefers-contrast`: increase border widths and contrast in high-contrast mode. | COULD |
| VA-5 | Font sizes MUST be specified in relative units (`rem` or `em`) to respect user font-size preferences. | SHOULD |

### 4.4 Screen reader considerations

| ID | Requirement | Priority |
|----|-------------|----------|
| SR-1 | All images and icons MUST have appropriate `alt` text or `aria-label`. | SHOULD |
| SR-2 | Status changes (save status, evaluation status, errors) MUST use `aria-live` regions. | SHOULD |
| SR-3 | The block library MUST be navigable via screen reader (list with item roles). | SHOULD |
| SR-4 | Node values in the inspector MUST be announced when they change (polite live region). | COULD |

---

## 5. Observability

### 5.1 Debug Console (application-level)

See [03-web-app-requirements.md §9](03-web-app-requirements.md#9-debug-console) for
the full Debug Console specification. Key cross-cutting requirements:

| ID | Requirement | Priority |
|----|-------------|----------|
| OB-1 | The debug console MUST be available on all platforms (Web, Mobile optional, Desktop mandatory). | MUST |
| OB-2 | Log format MUST be consistent across platforms (same entry structure, same categories). | MUST |
| OB-3 | The console MUST NOT ship logs externally by default. All logging is local. | MUST |
| OB-4 | Enterprise may configure an internal log endpoint (opt-in, policy-controlled). | COULD |

### 5.2 Structured logging (optional)

| ID | Requirement | Priority |
|----|-------------|----------|
| SL-1 | The app SHOULD support a `StructuredLogger` interface that emits JSON log lines. | SHOULD |
| SL-2 | The structured logger SHOULD be wired to: debug console UI, persistent log file (desktop), and optional external endpoint (enterprise). | SHOULD |
| SL-3 | Log fields MUST include: `timestamp`, `level`, `category`, `message`, `metadata` (key-value pairs). | SHOULD |
| SL-4 | The structured logger MUST support the same verbosity levels as the debug console (error, warn, info, debug, trace). | SHOULD |

### 5.3 Performance monitoring

| ID | Requirement | Priority |
|----|-------------|----------|
| PM-1 | Engine evaluation timing MUST be captured and exposed in the debug console (`perf` category). | MUST |
| PM-2 | Canvas frame rate SHOULD be monitorable via the `?perf=1` URL parameter (web) or a dev tools toggle. | SHOULD |
| PM-3 | WASM init timing MUST be logged at `info` level. | MUST |
| PM-4 | Memory usage estimates SHOULD be logged at `debug` level (via `performance.memory` where available). | COULD |

---

## 6. Testing requirements

### 6.1 Unit tests

| ID | Requirement | Priority |
|----|-------------|----------|
| UT-1 | Unit tests MUST cover the engine evaluation logic: all ops, edge cases (division by zero, NaN propagation, cycle detection). | MUST |
| UT-2 | Unit tests MUST cover binding resolution (`resolveBindings.ts`). | MUST |
| UT-3 | Unit tests MUST cover entitlement logic (`entitlements.ts`). | MUST |
| UT-4 | Unit tests MUST cover schema migration functions. | SHOULD |
| UT-5 | Unit tests MUST be runnable via `npm run test:unit` (vitest) and `cargo test --workspace` (Rust). | MUST |
| UT-6 | Code coverage SHOULD be ≥ 70% for `src/lib/`, `src/engine/`, and `crates/engine-core/src/`. | SHOULD |

### 6.2 Integration tests

| ID | Requirement | Priority |
|----|-------------|----------|
| IT-1 | Integration tests MUST verify the WASM worker round-trip: snapshot → evaluate → result. | MUST |
| IT-2 | Integration tests MUST verify save/load round-trip: save project → reload → graph state matches. | SHOULD |
| IT-3 | Integration tests MUST verify binding resolution with real WASM constants. | SHOULD |

### 6.3 End-to-end tests

| ID | Requirement | Priority |
|----|-------------|----------|
| E2E-1 | E2E smoke tests (10 tests) MUST run on every push to main. They MUST cover: app load, create project, add blocks, connect edges, evaluate, save. | MUST |
| E2E-2 | Full E2E suite MUST run nightly. It MUST cover: all node kinds, all menu actions, undo/redo, cut/copy/paste, multi-canvas, variables, CSV import, plots. | MUST |
| E2E-3 | E2E tests MUST use Playwright. | MUST |
| E2E-4 | E2E tests MUST NOT depend on external services (use Supabase local or mocks). | SHOULD |

### 6.4 Rust engine tests

| ID | Requirement | Priority |
|----|-------------|----------|
| RT-1 | Golden fixture tests: a set of known input snapshots with expected output values. MUST be run in CI. | MUST |
| RT-2 | Property tests (proptest/quickcheck): random graph generation → no panics, deterministic results. | SHOULD |
| RT-3 | Catalog completeness test: every `CatalogEntry` has a corresponding match arm in `ops.rs`. | MUST |
| RT-4 | Benchmark tests: track evaluation performance for regression detection. | SHOULD |

### 6.5 Cross-platform tests

| ID | Requirement | Priority |
|----|-------------|----------|
| XP-1 | The `.chainsolvejson` file format MUST be tested: export from web → import on desktop → identical evaluation results. | SHOULD |
| XP-2 | Mobile smoke test: app launches in emulator, loads a project, displays values. | SHOULD |
| XP-3 | Desktop smoke test: app launches, opens a local project, evaluates, saves. | SHOULD |

---

## 7. Release checklist

Before any production release, the following gates MUST pass:

### 7.1 Code quality gates

- [ ] TypeScript typecheck passes (`npm run typecheck`).
- [ ] ESLint passes with zero errors (`npm run lint`).
- [ ] Prettier formatting is consistent (`npm run format --check`).
- [ ] Rust `cargo test --workspace` passes.
- [ ] Vitest unit tests pass (`npm run test:unit`).
- [ ] Vite production build succeeds (`npm run build`).

### 7.2 E2E gates

- [ ] Playwright smoke suite passes (10 tests).
- [ ] No new accessibility regressions (manual spot-check or automated axe scan).

### 7.3 Security gates

- [ ] No new critical/high Dependabot alerts.
- [ ] CSP header is correctly set in production.
- [ ] No secrets in committed code (checked via git-secrets or equivalent).

### 7.4 Performance gates

- [ ] Lighthouse performance score ≥ 80 for the login page.
- [ ] WASM init < 1 second on CI runner.
- [ ] 500-node evaluation < 100 ms on CI runner.

### 7.5 Release process

1. All gates above MUST pass on the release branch.
2. Create a git tag (`web-vX.Y.Z`, `desktop-vX.Y.Z`, `mobile-vX.Y.Z`).
3. CI builds and deploys artifacts (Cloudflare Pages for web; signed binaries for desktop; app store submission for mobile).
4. Verify deployment health via `/api/healthz` and `/api/readyz`.
5. Monitor error rates for 1 hour post-deploy.

---

## 8. Coding standards

| ID | Requirement | Priority |
|----|-------------|----------|
| CD-1 | TypeScript MUST use `import type` for type-only imports (enforced by `verbatimModuleSyntax`). | MUST |
| CD-2 | Unused function parameters MUST be prefixed with `_`. | MUST |
| CD-3 | Prettier configuration: `singleQuote: true`, `semi: false`, `tabWidth: 2`. | MUST |
| CD-4 | No `any` types except in type assertion bridges (WASM boundary). Prefer `unknown` + type narrowing. | MUST |
| CD-5 | React components MUST be functional (no class components). | MUST |
| CD-6 | State management MUST use Zustand or React Context (no Redux, no MobX). | MUST |
| CD-7 | CSS MUST use CSS variables for theming (no hard-coded colors). | MUST |
| CD-8 | i18n: all user-facing strings MUST be in locale files, not hard-coded in components. | MUST |

---

## 9. Documentation standards

| ID | Requirement | Priority |
|----|-------------|----------|
| DOC-1 | Architecture decisions MUST be recorded as ADRs in `docs/DECISIONS/`. | MUST |
| DOC-2 | New features MUST be documented in `docs/README.md` (summary) and a dedicated doc if complex. | MUST |
| DOC-3 | API changes (service functions, adapter interface) MUST be documented in code (JSDoc) and in relevant spec files. | SHOULD |
| DOC-4 | This requirements suite MUST be kept up-to-date via the change process defined in [README.md](README.md). | MUST |

---

## 10. Out of scope (for now)

- Formal penetration testing (manual security review is sufficient for current scale).
- SOC 2 / ISO 27001 certification (enterprise roadmap).
- Full WCAG 2.1 AAA compliance (AA is the target).
- Automated visual regression testing (screenshot diffing).
- Chaos engineering / fault injection testing.
- i18n for right-to-left (RTL) languages.

---

## 11. Future extensions

1. **Formal security audit**: Engage a third-party firm for penetration testing before enterprise launch.
2. **SOC 2 compliance**: Required for enterprise customers in regulated industries.
3. **Visual regression testing**: Playwright screenshot comparison for UI changes.
4. **RTL language support**: Arabic, Hebrew UI layouts.
5. **Automated accessibility testing**: Axe-core integration in E2E suite.
6. **Chaos testing**: Simulate Supabase outages, WASM worker crashes, storage failures.
7. **Performance regression CI**: Automated benchmarks that fail the build on regression.

---

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2026-02-26 | — | Initial version (v1.0). |
