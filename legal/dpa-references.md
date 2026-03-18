# Data Processing Agreements — Reference Index

> Last updated: 2026-03-17
> Covers items 16.39-16.42.
>
> Actual signed DPAs and downloaded PDFs must be stored in this directory
> and are gitignored (*.pdf). This document tracks which DPAs are in effect
> and where to obtain them.

## Status Summary

| Provider | DPA Type | Status | Source | PDF Stored |
|----------|----------|--------|--------|-----------|
| Supabase | Data Processing Agreement | ✅ Accept in dashboard | supabase.com/privacy | `legal/supabase-dpa.pdf` |
| Stripe | DPA (auto-applied 2023+) | ✅ Auto-applied to all accounts | stripe.com/legal/dpa | `legal/stripe-dpa.pdf` |
| Resend | Data Processing Agreement | ✅ Accept in dashboard | resend.com/legal | `legal/resend-dpa.pdf` |
| Cloudflare | Data Processing Addendum | ✅ Available in dashboard | cloudflare.com/privacypolicy | `legal/cloudflare-dpa.pdf` |
| Sentry | Data Processing Agreement | ✅ Accept in dashboard | sentry.io/legal/dpa/ | `legal/sentry-dpa.pdf` |
| OpenAI | Data Processing Addendum | ✅ Available in account | platform.openai.com/account | `legal/openai-dpa.pdf` |

---

## 16.39 — Supabase DPA

**Action required:** Log in to Supabase dashboard → Settings → Legal → accept the DPA.

- DPA URL: https://supabase.com/privacy
- Download URL: Available from Supabase dashboard → Settings → Legal after acceptance
- Registered entity: Supabase Inc. (Delaware, USA)
- Transfer mechanism: UK IDTA / EU SCCs
- Data region: EU-West (AWS eu-west-1) — verify in project settings

---

## 16.40 — Stripe DPA

**Status:** Stripe automatically applies their DPA to all accounts as of 2023.
No manual acceptance required.

- DPA URL: https://stripe.com/legal/dpa
- Download: https://stripe.com/legal/dpa (downloadable PDF)
- Registered entity: Stripe, Inc. (Delaware, USA)
- Transfer mechanism: UK IDTA / EU SCCs (Module 2 for controller→processor)

---

## 16.41 — Resend DPA

**Action required:** Log in to Resend dashboard → Settings → Privacy → accept DPA.

- DPA URL: https://resend.com/legal/dpa
- Registered entity: Resend Inc. (USA)
- Transfer mechanism: UK IDTA / EU SCCs

---

## 16.42 — Other Sub-Processor DPAs

### Cloudflare

**Action required:** Log in to Cloudflare dashboard → Account → Legal → Data Processing Addendum.

- DPA URL: https://www.cloudflare.com/cloudflare-customer-dpa/
- Registered entity: Cloudflare, Inc. (Delaware, USA)
- Transfer mechanism: EU SCCs / UK IDTA

### Sentry

**Action required:** Log in to Sentry dashboard → Settings → Legal → accept DPA.

- DPA URL: https://sentry.io/legal/dpa/
- Registered entity: Functional Software, Inc. dba Sentry (USA)
- Transfer mechanism: EU SCCs / UK IDTA

### OpenAI

**Action required:** Log in to OpenAI platform → Account settings → Data privacy.

- DPA URL: https://openai.com/policies/data-processing-addendum
- Note: ChainSolve AI uses `store: false` — OpenAI does not retain prompts/responses
- Registered entity: OpenAI, LLC (Delaware, USA)
- Transfer mechanism: EU SCCs / UK IDTA

---

## PDF File Storage

Place downloaded DPA PDFs in this directory:

```
legal/
├── supabase-dpa.pdf      (gitignored — download from Supabase dashboard)
├── stripe-dpa.pdf        (gitignored — download from stripe.com/legal/dpa)
├── resend-dpa.pdf        (gitignored — download from Resend dashboard)
├── cloudflare-dpa.pdf    (gitignored — download from Cloudflare dashboard)
├── sentry-dpa.pdf        (gitignored — download from Sentry dashboard)
└── openai-dpa.pdf        (gitignored — download from OpenAI platform)
```

Add to `.gitignore`:
```
legal/*.pdf
```
