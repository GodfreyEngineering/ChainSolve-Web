# ADR-0002 — CSP `'wasm-unsafe-eval'`

| Field | Value |
|-------|-------|
| Status | Accepted |
| Decided | W9.5.4 |
| Supersedes | — |
| Affects | `public/_headers`, `docs/SECURITY.md`, `e2e/smoke.spec.ts` |

---

## Context

The Rust/WASM engine (ADR-0001) requires `WebAssembly.instantiateStreaming()`
to compile and instantiate the `.wasm` binary at runtime inside a Web Worker.

Browsers gate WebAssembly compilation under the `script-src` directive of the
Content Security Policy — including inside workers that inherit the parent
page's policy.  Without an explicit allowance, browsers block WASM compilation:

> Refused to compile or instantiate WebAssembly module because neither
> `'unsafe-eval'` nor `'wasm-unsafe-eval'` appears in the `script-src`
> directive of the Content Security Policy.

There are two directives that allow WASM compilation:

| Directive | Allows | Risk |
|-----------|--------|------|
| `'unsafe-eval'` | WASM + `eval(string)` + `new Function(string)` + string timers | HIGH — enables arbitrary JS string execution |
| `'wasm-unsafe-eval'` | WASM compilation only | LOW — no JS string execution |

---

## Decision

Use `'wasm-unsafe-eval'` (and only `'wasm-unsafe-eval'`) in `script-src`.
Never use `'unsafe-eval'`.

The current `script-src` directive:

```
script-src 'self' 'wasm-unsafe-eval'
```

This is the minimum required to run the Rust/WASM engine without enabling
arbitrary JavaScript string execution.

**Browser support:** Chrome 95+ (Sep 2021), Firefox 102+ (Jun 2022),
Safari 16+ (Sep 2022).  These versions predate any supported device.

**Enforcement:** A Playwright smoke test (`e2e/smoke.spec.ts`) reads
`public/_headers` directly and asserts `'wasm-unsafe-eval'` is present.
The test also asserts `'unsafe-eval'` is **not** present without `wasm-`.

---

## Consequences

**Positive:**
- WASM engine compiles and runs in all supported browsers.
- Attack surface is minimal: only WebAssembly compilation is permitted, not
  arbitrary JS string evaluation.
- The distinction between `'wasm-unsafe-eval'` and `'unsafe-eval'` is
  explicitly enforced by the smoke test and documented for future maintainers.

**Negative / trade-offs:**
- Any library or dependency that relies on `eval()` or `new Function()` will
  be blocked.  (Currently none do; Vega-Lite is loaded via
  `vega-interpreter` for exactly this reason — see `src/lib/vega-loader.ts`.)
- CSP reports (`csp_reports` table) will show a `WASM_CSP_BLOCKED` code if the
  directive is ever accidentally removed.

---

## What `'unsafe-eval'` permits that `'wasm-unsafe-eval'` does not

This is the key reason `'unsafe-eval'` is dangerous:

- `eval("malicious code here")` — run arbitrary JS from a string
- `new Function("malicious code")` — same
- `setTimeout("malicious code", 0)` — same via timers
- `setInterval("malicious code", 0)` — same

All of these are XSS escalation vectors.  An attacker who can inject a string
into user-controlled data could execute it as code if `'unsafe-eval'` is set.
`'wasm-unsafe-eval'` blocks all of the above.

---

## Cloudflare Analytics beacon

Cloudflare Web Analytics injects `beacon.min.js` from
`static.cloudflareinsights.com`.  This feature is **disabled** on ChainSolve
because enabling it would require adding a third-party origin to `script-src`,
weakening the policy.

If it is ever enabled, `static.cloudflareinsights.com` must be added to both
`script-src` and `connect-src`.  See `docs/SECURITY.md §5` for the full
procedure.

---

## See also

- `docs/SECURITY.md §2` — Full CSP policy with all directives explained
- `e2e/smoke.spec.ts` — Smoke test that guards the `_headers` file
- `src/engine/worker.ts` — `WASM_CSP_BLOCKED` error detection
