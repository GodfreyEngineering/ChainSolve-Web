# Record of Processing Activities (ROPA)

> **Document:** Art. 30 GDPR / UK GDPR Record of Processing Activities
> **Data Controller:** Godfrey Engineering Ltd, Company No. 16845827
> **Jurisdiction:** England & Wales
> **Last updated:** 2026-03-17
> **Review frequency:** Annually or when a new processing activity is added

---

## 1. Account Registration and Authentication

| Field | Detail |
|-------|--------|
| **Processing activity** | Creating and managing user accounts; authenticating users |
| **Categories of data subjects** | Registered users (individuals) |
| **Categories of personal data** | Email address; display name; avatar (optional); hashed credentials; authentication tokens; last-login timestamp; account creation timestamp |
| **Purposes** | Enable users to create accounts, log in, and access the Service |
| **Legal basis** | Art. 6(1)(b) — contract performance |
| **Recipients / sub-processors** | Supabase Inc. (authentication, database) |
| **International transfers** | UK→USA — UK IDTA / EU SCCs with Supabase Inc. |
| **Retention period** | Until account deletion; purged within 30 days of deletion request |

---

## 2. Project Data Storage

| Field | Detail |
|-------|--------|
| **Processing activity** | Storing computation graphs, node configurations, and variable values created by the user |
| **Categories of data subjects** | Registered users (individuals) |
| **Categories of personal data** | Computation graph content (user-created; may contain engineer/scientist name, organisation, or project-specific data); file uploads |
| **Purposes** | Provide cloud storage so users can save, retrieve, and share projects |
| **Legal basis** | Art. 6(1)(b) — contract performance |
| **Recipients / sub-processors** | Supabase Inc. (PostgreSQL database, object storage) |
| **International transfers** | UK→USA — UK IDTA / EU SCCs with Supabase Inc. |
| **Retention period** | Until account deletion; read-only access for 30 days post-deletion; purged within 30 days of deletion request |

---

## 3. Payment Processing

| Field | Detail |
|-------|--------|
| **Processing activity** | Processing subscription payments; managing billing |
| **Categories of data subjects** | Paying customers (individuals and organisations) |
| **Categories of personal data** | Stripe customer ID; subscription status; invoice history; billing email |
| **Purposes** | Collect payment for Pro/Enterprise subscriptions; issue receipts |
| **Legal basis** | Art. 6(1)(b) — contract performance |
| **Recipients / sub-processors** | Stripe, Inc. (payment processor) |
| **International transfers** | UK→USA — UK IDTA / EU SCCs with Stripe, Inc. (auto-applied DPA) |
| **Retention period** | Financial records retained 7 years per HMRC / Companies Act 2006 |

---

## 4. Transactional Email

| Field | Detail |
|-------|--------|
| **Processing activity** | Sending transactional emails (password reset, billing receipts, important account notices) |
| **Categories of data subjects** | Registered users |
| **Categories of personal data** | Email address; name (in email greeting); email content |
| **Purposes** | Deliver service-critical notifications |
| **Legal basis** | Art. 6(1)(b) — contract performance |
| **Recipients / sub-processors** | Resend Inc. (email delivery) |
| **International transfers** | UK→USA — UK IDTA / EU SCCs with Resend Inc. |
| **Retention period** | Email delivery logs retained 90 days; support communications retained 3 years |

---

## 5. Marketing Email

| Field | Detail |
|-------|--------|
| **Processing activity** | Sending marketing emails, product updates, and newsletters |
| **Categories of data subjects** | Opted-in registered users |
| **Categories of personal data** | Email address; name |
| **Purposes** | Keep opted-in users informed of new features, releases, and relevant updates |
| **Legal basis** | Art. 6(1)(a) — consent (affirmative opt-in; withdrawable at any time) |
| **Recipients / sub-processors** | Resend Inc. (email delivery) |
| **International transfers** | UK→USA — UK IDTA / EU SCCs with Resend Inc. |
| **Retention period** | Until consent is withdrawn; email address removed within 30 days of opt-out |

---

## 6. Security Logging and Fraud Prevention

| Field | Detail |
|-------|--------|
| **Processing activity** | Recording security-relevant events: login attempts, session creation, ToS acceptance, rate limit breaches |
| **Categories of data subjects** | All visitors and users |
| **Categories of personal data** | IP address; user agent; user ID (if authenticated); event type and timestamp |
| **Purposes** | Detect and prevent abuse, credential stuffing, fraud, and unauthorised access |
| **Legal basis** | Art. 6(1)(f) — legitimate interests (securing the service and users' accounts) |
| **Recipients / sub-processors** | Supabase Inc. (audit log storage); Cloudflare Inc. (DDoS protection, CDN) |
| **International transfers** | UK→USA — UK IDTA / EU SCCs with Supabase Inc. and Cloudflare Inc. |
| **Retention period** | 90 days, then deleted |

---

## 7. Aggregated Analytics

| Field | Detail |
|-------|--------|
| **Processing activity** | Measuring aggregate feature usage to improve the service |
| **Categories of data subjects** | All authenticated users |
| **Categories of personal data** | Feature usage counts (e.g. AI token usage); anonymised performance metrics; no PII |
| **Purposes** | Understand which features are used most; prioritise development |
| **Legal basis** | Art. 6(1)(f) — legitimate interests (product improvement); data is anonymised before storage |
| **Recipients / sub-processors** | Internal — no third-party analytics provider |
| **International transfers** | None (first-party, Supabase EU region) |
| **Retention period** | Indefinitely (anonymised; not linkable to individuals) |

---

## 8. Error Reporting and Application Diagnostics

| Field | Detail |
|-------|--------|
| **Processing activity** | Capturing JavaScript exceptions, performance traces, and web vitals to diagnose bugs |
| **Categories of data subjects** | Consenting users |
| **Categories of personal data** | Daily-rotating pseudonymous session UUID (not linked to user account); browser user agent; anonymised stack trace; page URL (path only, no query params with PII); Cloudflare country/colo metadata |
| **Purposes** | Detect and fix software defects; monitor performance |
| **Legal basis** | Art. 6(1)(a) — consent (requires explicit cookie consent acceptance) |
| **Recipients / sub-processors** | Functional Software, Inc. dba Sentry (error tracking, optional); internal Cloudflare Worker (primary pipeline) |
| **International transfers** | UK→USA — UK IDTA / EU SCCs with Sentry (if enabled) |
| **Retention period** | 30 days in Sentry; 7 days in internal pipeline |

---

## 9. Support Communications

| Field | Detail |
|-------|--------|
| **Processing activity** | Receiving and responding to user support requests |
| **Categories of data subjects** | Users who contact support |
| **Categories of personal data** | Email address; name; content of communication |
| **Purposes** | Respond to user questions, complaints, and data subject requests |
| **Legal basis** | Art. 6(1)(b) — contract performance; Art. 6(1)(c) — legal obligation (subject access requests) |
| **Recipients / sub-processors** | None (internal email; CONTACT.support mailbox) |
| **International transfers** | None |
| **Retention period** | 3 years, unless subject to ongoing legal matter |

---

## 10. Terms Acceptance Audit Log

| Field | Detail |
|-------|--------|
| **Processing activity** | Recording that a user accepted the Terms & Conditions at a specific version |
| **Categories of data subjects** | Registered users |
| **Categories of personal data** | User ID; ToS version number; acceptance timestamp; IP address; user agent |
| **Purposes** | Demonstrate informed consent; defend against disputes about ToS acceptance |
| **Legal basis** | Art. 6(1)(f) — legitimate interests (legal defence); Art. 6(1)(c) — legal obligation |
| **Recipients / sub-processors** | Supabase Inc. (database) |
| **International transfers** | UK→USA — UK IDTA / EU SCCs with Supabase Inc. |
| **Retention period** | Retained until account deletion then purged within 90 days (financial records exemption applies to payment records only) |

---

## Review History

| Date | Reviewer | Changes |
|------|----------|---------|
| 2026-03-17 | Godfrey Engineering Ltd | Initial ROPA created |
