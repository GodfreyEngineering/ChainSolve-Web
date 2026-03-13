# Security Policy

## Security Contact

**Email:** security@chainsolve.co.uk

For urgent issues (P1/P2), also contact the on-call developer directly via the internal Slack channel `#security-incidents`.

## Reporting a Vulnerability

If you discover a security vulnerability in ChainSolve, please report it responsibly. **Do not open a public GitHub issue.**

Email: **security@chainsolve.co.uk**

Include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We aim to acknowledge reports within 48 hours and provide a fix or mitigation plan within 7 days for critical issues.

### Disclosure Timeline

| Step | Target |
|------|--------|
| Acknowledgement | 48 hours |
| Initial assessment + severity | 72 hours |
| Fix for P1 (critical) | 24 hours |
| Fix for P2 (high) | 7 days |
| Fix for P3 (medium) | 30 days |
| Fix for P4 (low) | Next release cycle |
| Public disclosure | After fix deployed + 30 days |

## Severity Classification

### P1 — Critical

- Remote code execution
- Authentication bypass (any user can access any account)
- Data breach (bulk access to user data)
- Stripe/payment credential exposure
- Service role key exposure

**Response:** Immediate. All hands. Fix and deploy within 24 hours. Consider taking the service offline if actively exploited.

### P2 — High

- Privilege escalation (user can access another user's data)
- RLS bypass on sensitive tables
- CSRF/XSS that can exfiltrate session tokens
- Broken access control on admin endpoints
- API key exposure in client bundle

**Response:** Within 24 hours. Fix and deploy within 7 days. Notify affected users if data was accessed.

### P3 — Medium

- Information disclosure (non-sensitive data leakage)
- CSP bypass that doesn't lead to data exfiltration
- Rate limiting bypass
- Denial of service via resource exhaustion
- Missing security headers on non-critical paths

**Response:** Within 72 hours. Fix in next planned release.

### P4 — Low

- Theoretical vulnerabilities with no practical exploit path
- Missing best-practice headers with no security impact
- Self-XSS (only affects the attacker's own session)
- Verbose error messages exposing stack traces

**Response:** Track in backlog. Fix when convenient.

## Incident Response Checklist

### Phase 1: Detect

- [ ] Alert received (automated monitoring, user report, or security scan)
- [ ] Assign incident commander (IC)
- [ ] Create private incident channel (Slack `#incident-YYYY-MM-DD`)
- [ ] Classify severity (P1–P4 per above)
- [ ] Document initial findings in incident log

### Phase 2: Contain

- [ ] Identify the attack vector and affected systems
- [ ] Revoke compromised credentials (API keys, tokens, service role keys)
- [ ] If P1 and actively exploited: enable Cloudflare "Under Attack" mode
- [ ] Block attacker IPs via Cloudflare WAF rules if applicable
- [ ] Preserve evidence (logs, database snapshots, request traces)
- [ ] Notify Supabase support if auth system is compromised

### Phase 3: Eradicate

- [ ] Develop and test the fix in a private branch
- [ ] Review fix with at least one other developer
- [ ] Verify the fix addresses the root cause, not just symptoms
- [ ] Check for similar vulnerabilities in related code paths
- [ ] Update security tests to cover the vulnerability

### Phase 4: Recover

- [ ] Deploy the fix to production via normal CI/CD pipeline
- [ ] Verify the fix is working in production (check logs, test endpoint)
- [ ] Rotate any credentials that may have been compromised
- [ ] Re-enable any services that were disabled during containment
- [ ] Monitor for recurrence (24–72 hours of elevated monitoring)

### Phase 5: Lessons Learned

- [ ] Write post-incident report within 5 business days
- [ ] Include: timeline, root cause, impact, response actions, prevention measures
- [ ] Update security documentation and runbooks
- [ ] Add automated detection for this class of vulnerability
- [ ] Share anonymised findings with the team (blameless)

## Escalation Procedures

| Severity | Who to notify | When |
|----------|--------------|------|
| P1 | All developers + CTO + legal | Immediately |
| P2 | Lead developer + security contact | Within 4 hours |
| P3 | Security contact | Within 24 hours |
| P4 | Track in issue tracker | Next triage meeting |

### External Notifications

- **Users:** Notify affected users within 72 hours if personal data was accessed (GDPR Article 34)
- **ICO (UK):** Report to Information Commissioner's Office within 72 hours if personal data breach (GDPR Article 33)
- **Stripe:** Contact Stripe support if payment data was involved
- **Supabase:** Contact Supabase if their infrastructure was involved

## Security Architecture

For details on our security architecture (CSP, RLS, storage ACLs, headers), see [docs/SECURITY.md](docs/SECURITY.md).

## Supported Versions

Only the latest release on the `main` branch is supported with security updates. There are no LTS branches.

## Security Tools and Resources

- **Cloudflare WAF:** First line of defense — rate limiting, bot detection, DDoS protection
- **Supabase RLS:** Row-level security on all 29+ tables
- **CSP headers:** Strict Content-Security-Policy in `public/_headers`
- **Audit log:** All security-relevant actions logged to `audit_log` table
- **Sentry:** Error tracking and session replay for post-incident analysis
- **Dependabot:** Automated dependency vulnerability scanning
