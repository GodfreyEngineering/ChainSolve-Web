# Data Breach Incident Response Plan

> **Document:** GDPR Art. 33/34 Breach Notification Procedure
> **Data Controller:** Godfrey Engineering Ltd, Company No. 16845827
> **Last updated:** 2026-03-17
> **Review frequency:** Annually and after any incident

---

## 1. Overview

Under UK GDPR Art. 33, Godfrey Engineering Ltd must notify the ICO within **72 hours** of
becoming aware of a personal data breach that poses a risk to individuals. Under Art. 34, affected
individuals must be notified "without undue delay" if the breach poses a **high risk** to their rights
and freedoms.

This document sets out: how to detect a breach, how to assess its severity, who to notify, and
template notification messages.

---

## 2. What Constitutes a Personal Data Breach

A personal data breach is any security incident that leads to:
- **Unauthorised access** to personal data (e.g. database accessed by attacker)
- **Accidental or unlawful destruction** of personal data
- **Loss** of personal data (e.g. irreversible deletion)
- **Alteration** of personal data without authorisation
- **Unauthorised disclosure** or exposure of personal data

This includes both **intentional** (attacker) and **accidental** (misconfiguration, bug) causes.

---

## 3. Detection

### 3.1 Monitoring Sources

| Source | Signal | Who Monitors |
|--------|--------|--------------|
| Supabase Audit Logs | Unusual query patterns, failed auth bursts, unexpected bulk exports | Engineer on call |
| Cloudflare Security Events | WAF triggers, DDoS events, unusual bot traffic | Engineer on call |
| Sentry Error Tracking | Sudden spike in auth errors or unexpected data access errors | Engineer on call |
| Stripe Radar / Webhooks | Unusual charge patterns, stolen card alerts | Finance lead |
| User Reports | Users reporting unexpected account activity | Support mailbox |
| Internal Observability | Rate-limit breaches, abnormal session counts | Engineer on call |

### 3.2 Initial Triage (within 1 hour of detection)

1. Isolate the affected system (revoke API keys, disable compromised accounts, enable read-only mode if needed)
2. Preserve evidence (export logs before rotation; take database snapshots)
3. Alert internal team: send message to engineering Slack channel and notify company director
4. Begin this incident response procedure

---

## 4. Severity Assessment

Assess the breach using the following criteria:

| Criterion | Low | Medium | High |
|-----------|-----|--------|------|
| Nature of data exposed | Anonymised or pseudonymised | Email addresses, usernames | Passwords, payment data, sensitive content |
| Number of individuals affected | < 10 | 10–1,000 | > 1,000 |
| Likely consequences | Inconvenience | Embarrassment, unsolicited contact | Financial loss, identity theft, physical harm |

**Low severity:** Document internally; no notification required unless there is a pattern.

**Medium severity:** Notify ICO within 72 hours; consider notifying affected users.

**High severity:** Notify ICO within 72 hours; **must** notify affected users without undue delay.

---

## 5. Containment and Remediation

| Step | Action |
|------|--------|
| 5.1 | **Contain:** Revoke compromised credentials, API keys, or sessions |
| 5.2 | **Isolate:** Disable the compromised feature/endpoint if still actively exploited |
| 5.3 | **Investigate root cause:** Review logs, identify attack vector, patch vulnerability |
| 5.4 | **Recover:** Restore from clean backup if data was destroyed; apply hotfix |
| 5.5 | **Verify:** Confirm breach is contained; check for persistence mechanisms |
| 5.6 | **Document:** Record all actions, timestamps, and decisions in incident log |

---

## 6. ICO Notification (Art. 33)

**Threshold:** Required if the breach is likely to result in a risk to individuals' rights and freedoms.
**Deadline:** Within **72 hours** of becoming aware.
**Channel:** https://ico.org.uk/for-organisations/report-a-breach/

### ICO Notification must include:

- Nature of the breach (what happened, how)
- Categories and approximate number of individuals affected
- Categories and approximate volume of personal data records affected
- Name and contact details of our Data Protection contact: support@chainsolve.co.uk
- Likely consequences of the breach
- Measures taken or proposed to address the breach

### ICO Notification Template

```
Subject: Personal Data Breach Notification — Godfrey Engineering Ltd

Organisation: Godfrey Engineering Ltd
Company Number: 16845827
Contact: support@chainsolve.co.uk

Date/time breach discovered: [DATE TIME UTC]
Date/time breach occurred (approx.): [DATE TIME UTC OR "UNKNOWN"]

Nature of breach:
[Describe what happened — e.g. "Unauthorised access to Supabase database via exposed API key"]

Categories of personal data affected:
[e.g. "Email addresses, hashed passwords, project names"]

Number of individuals affected (approx.):
[NUMBER]

Likely consequences:
[e.g. "Low risk of unauthorised account access; no financial data exposed"]

Measures taken:
[e.g. "API key revoked, affected sessions invalidated, vulnerability patched, users notified"]

Additional information: [any other relevant details]
```

---

## 7. User Notification (Art. 34)

**Threshold:** Required if the breach poses a **high risk** to individuals.
**Timing:** Without undue delay (aim for within 72 hours of determining high risk).
**Channel:** Email to all affected users' registered email addresses.

### User Notification Template

```
Subject: Important Security Notice — ChainSolve Account

Dear [Name or "ChainSolve user"],

We are writing to inform you of a security incident that may have affected your ChainSolve account.

What happened:
[Brief, plain-English description of the incident]

What data was involved:
[e.g. "Your email address and encrypted password hash were exposed. No payment data was involved."]

What we have done:
[e.g. "We have invalidated all sessions, patched the vulnerability, and revoked the
compromised access. We are also notifying the ICO."]

What you should do:
- Change your ChainSolve password immediately at: https://chainsolve.co.uk/reset-password
- If you use the same password elsewhere, change it on those services too.
- Watch for suspicious emails claiming to be from ChainSolve.

If you have questions, contact us at: support@chainsolve.co.uk

We sincerely apologise for this incident.

Godfrey Engineering Ltd
```

---

## 8. Post-Incident Review

Within 2 weeks of resolution:

1. Write a full incident report (timeline, root cause, impact, remediation)
2. Update ROPA and security documentation if data categories, sub-processors, or retention policies change
3. Update this breach response plan if gaps were identified
4. Consider engaging an external security firm for a post-incident review if severity was High
5. Review whether any further ICO follow-up is required

---

## 9. Internal Incident Log Template

| Field | Entry |
|-------|-------|
| Incident ID | INC-YYYY-NNN |
| Date discovered | |
| Discovered by | |
| Nature of breach | |
| Data affected | |
| Individuals affected (approx.) | |
| Severity assessment | Low / Medium / High |
| ICO notified | Yes / No / N/A |
| ICO reference | |
| Users notified | Yes / No / N/A |
| Root cause | |
| Remediation steps | |
| Incident closed | |

---

## 10. Contact

- **Internal:** director@chainsolve.co.uk (or current company director)
- **ICO breach reporting:** https://ico.org.uk/for-organisations/report-a-breach/
- **ICO general enquiries:** 0303 123 1113
