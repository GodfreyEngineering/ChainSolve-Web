# Release Dry-Run Playbook

> F7-1 — Step-by-step release rehearsal that any team member can follow.
> Run this before every production deploy to catch issues early.

---

## 0. Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Node | 20+ | `node -v` |
| Rust | stable | `rustc --version` |
| wasm-pack | 0.13+ | `wasm-pack --version` |
| Playwright | installed | `npx playwright --version` |

---

## 1. Local gate — verify-ci.sh

```bash
./scripts/verify-ci.sh
```

**Must print `All CI checks passed.`** — if any step fails, fix before
proceeding. This runs 26 checks: prettier, ESLint, adapter boundary,
CSP allowlist, i18n hardcoded/missing, billing stack-trace, WASM build,
typecheck, vitest, cargo test, Vite build, bundle size, bundle splits,
perf budget, robots meta.

Typical runtime: 3-4 min (warm caches).

---

## 2. E2E smoke tests

```bash
npm run build
npx playwright test --project=smoke
```

**8 tests must pass.** Key checks:
- WASM engine boots without CSP errors
- `_headers` file contains `wasm-unsafe-eval` in both CSP headers
- Engine evaluates a basic chain correctly
- UI renders without fatal errors

If Playwright browsers are missing: `npx playwright install chromium`.

---

## 3. Auth flow validation

Run the app locally and test each flow:

```bash
npx vite preview          # serves dist/ on localhost:4173
```

| Flow | Steps | Expected |
|------|-------|----------|
| Sign up | `/signup` > enter email + password > submit | Confirmation email sent, "check your email" shown |
| Log in | `/login` > enter creds > submit | Redirected to `/app` |
| Password reset | `/reset-password` > enter email | Reset email sent |
| Session persistence | Close tab > reopen `/app` | Still logged in |
| Sign out | Settings > Sign out | Redirected to `/login` |

---

## 4. CSP verification

Open DevTools Console on the running app:

- [ ] Zero `[Report Only]` CSP warnings in Console
- [ ] Zero enforced CSP errors in Console
- [ ] Network tab: no blocked requests to external origins

Verify headers:

```bash
curl -sI https://app.chainsolve.co.uk | grep -i content-security-policy
# Both Content-Security-Policy and Content-Security-Policy-Report-Only present
```

---

## 5. Exports gating

Test that export features respect entitlements:

| Export | Free tier | Pro tier |
|--------|-----------|----------|
| PDF audit report | Gated (upgrade prompt) | Works |
| Excel export | Gated | Works |
| .chainsolvejson | Works | Works |
| CSV import | Gated | Works |

---

## 6. AI copilot quotas (if enabled)

- [ ] Free users see quota limit in AI panel
- [ ] Pro users have higher quota
- [ ] Exhausted quota shows friendly message (not raw error)
- [ ] Server-side proxy at `/api/ai` returns 429 when quota exceeded

---

## 7. Billing flow

Test with Stripe test mode:

| Action | Expected |
|--------|----------|
| Click Upgrade (free user) | Stripe Checkout opens |
| Complete test payment | Redirected to `/billing/success` |
| Open Manage Billing | Stripe Customer Portal opens |
| Cancel subscription | Downgraded to free tier |

Test card: `4242 4242 4242 4242` (any future expiry, any CVC).

---

## 8. Performance check

```bash
# Bundle budgets (already checked by verify-ci)
node scripts/check-bundle-size.mjs
node scripts/check-perf-budget.mjs

# Lighthouse (manual)
# Open Chrome > DevTools > Lighthouse > Performance audit
# Target: Performance score >= 80, LCP < 4s, CLS < 0.1
```

---

## 9. Push and monitor CI

```bash
git push origin main
```

Monitor at: `https://github.com/<org>/ChainSolve-Web/actions`

CI pipeline stages:
1. `rust_tests` + `node_checks` (parallel, ~3 min)
2. `e2e_smoke` (sequential, ~90 s)
3. `deploy` (sequential, ~2 min)

**All 4 jobs must be green** before the app goes live.

---

## 10. Post-deploy smoke test

After Cloudflare Pages deployment completes:

- [ ] `https://app.chainsolve.co.uk` loads without errors
- [ ] Console: zero CSP violations
- [ ] Sign in with test account
- [ ] Create project, add blocks, connect edges, verify computation
- [ ] Save project, reload page, verify persistence
- [ ] Open block library, search for a block, drag onto canvas
- [ ] Verify WASM engine ready indicator (no fatal error banner)

---

## 11. Rollback procedure

If post-deploy checks fail:

**Option A — Cloudflare instant rollback:**
Cloudflare Dashboard > Pages > chainsolve-web > Deployments > select
previous successful deployment > "Rollback to this deployment".

**Option B — Git revert:**
```bash
git revert HEAD --no-edit
git push origin main
# CI redeploys the reverted code
```

---

## Quick reference: full dry-run checklist

```
[ ] verify-ci.sh passes
[ ] E2E smoke tests pass (8/8)
[ ] Auth flows work (signup, login, reset, signout)
[ ] CSP: zero console warnings/errors
[ ] Exports: gating works per tier
[ ] AI copilot: quotas enforced
[ ] Billing: Stripe checkout + portal work
[ ] Performance: bundle budgets met
[ ] git push + CI pipeline green (4/4 jobs)
[ ] Post-deploy smoke test passes
```
