# Analytics Strategy

> Decision record for analytics on the ChainSolve app domain (`app.chainsolve.co.uk`).

---

## Decision: No third-party analytics

ChainSolve does **not** use Google Analytics, Plausible, PostHog, Mixpanel, Amplitude, or any other third-party analytics SDK on the app domain.

### Rationale

1. **Privacy**: Engineering users expect no surprise tracking. No consent banners needed.
2. **CSP compliance**: Third-party scripts require `connect-src` allowlisting and `script-src` changes that widen the attack surface.
3. **Performance**: Zero-byte analytics overhead. No extra DNS lookups or render-blocking scripts.
4. **Regulatory simplicity**: No cookie consent flows for GDPR/PECR.

### Cloudflare Web Analytics

Cloudflare Web Analytics is **intentionally blocked** by CSP (see `public/_headers`). The beacon script `beacon.min.js` is not allowlisted in `script-src`. If Cloudflare dashboard enables Web Analytics, the injected beacon will fail silently with a CSP violation report.

---

## What we DO have: In-house observability

All telemetry is opt-in and flows through our own pipeline:

| Component | Purpose | Trigger |
|-----------|---------|---------|
| **Error capture** | Unhandled JS errors + promise rejections | `window.onerror`, `onunhandledrejection` |
| **React ErrorBoundary** | Component tree crashes | `componentDidCatch` |
| **CSP reports** | Content-Security-Policy violations | Browser `report-uri` / `report-to` |
| **Engine diagnostics** | WASM eval health metadata | User-initiated export |
| **Doctor checks** | Healthz, readyz, WASM, storage | User-initiated in `/diagnostics` |

### Opt-in controls

| Variable | Default | Effect |
|----------|---------|--------|
| `VITE_OBS_ENABLED` | disabled | Set `'true'` to enable client error reporting |
| `VITE_OBS_SAMPLE_RATE` | `1.0` | Fraction of events to send (0.0-1.0) |
| `VITE_DIAGNOSTICS_UI_ENABLED` | disabled | Show `/diagnostics` page in production |

### Privacy guarantees

- **No PII in events**: Aggressive redaction strips JWTs, emails, CC-like patterns, secret keys.
- **No IP storage**: Only Cloudflare colo/country/ASN metadata (from CF headers), never raw IPs.
- **No user content**: Graph nodes, edge data, project names, and variable values are never included.
- **Daily rotating session ID**: UUID v4, not linkable to user identity.
- **Server-only storage**: `observability_events` table has zero user-facing RLS policies.

### Data flow

```
Browser → POST /api/report/client → Cloudflare Function → observability_events (Supabase)
Browser → report-uri/report-to   → POST /api/report/csp → observability_events (Supabase)
```

---

## Marketing site analytics (separate domain)

If analytics are needed for the marketing/landing site (`chainsolve.co.uk`), they should:

1. Use a privacy-respecting provider (Plausible or Cloudflare Web Analytics).
2. Be enabled on the **marketing domain only**, not the app domain.
3. Have their own CSP headers (separate `_headers` file or Cloudflare Pages project).
4. Never share cookies or session state with the app domain.

---

## Revisiting this decision

To add analytics to the app domain in the future:

1. Choose a provider that supports CSP nonce or strict `script-src` allowlisting.
2. Add the provider's domains to `connect-src` in `public/_headers`.
3. Implement opt-in consent (toggle in Settings > Preferences).
4. Update this document.
5. Run `./scripts/verify-ci.sh` to confirm no CSP violations.
