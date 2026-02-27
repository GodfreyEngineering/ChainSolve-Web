## Summary

<!-- Describe what this PR changes and why. -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor / cleanup
- [ ] Docs / config only

## Checklist

### Code
- [ ] `./scripts/verify-ci.sh` passes locally
- [ ] New logic has unit tests; existing tests still pass
- [ ] No hard-coded strings — i18n keys used for all UI text
- [ ] No Supabase/DB calls in UI components (use `src/lib/` helpers)
- [ ] No secrets or credentials committed

### Docs
- [ ] `docs/ROADMAP_CHECKLIST.md` ticked for any items completed
- [ ] `docs/SECURITY.md` updated if security posture changed
- [ ] `docs/ARCHITECTURE.md` / `docs/DATA_MODEL.md` updated if structure changed
- [ ] Migration files added to `supabase/migrations/` and documented if schema changed

### Product
- [ ] Entitlement gates respected (free / trialing / pro / past_due / canceled)
- [ ] Empty states handled for new list/search UI
- [ ] Accessibility: keyboard navigation and ARIA labels considered
