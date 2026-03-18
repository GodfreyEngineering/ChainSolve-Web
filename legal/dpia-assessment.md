# Data Protection Impact Assessment — Screening Decision

> **Document:** GDPR Art. 35 DPIA Screening
> **Data Controller:** Godfrey Engineering Ltd, Company No. 16845827
> **Last updated:** 2026-03-17
> **Review frequency:** Annually and when introducing new processing activities

---

## 1. Purpose

This document records the screening decision for whether a full Data Protection Impact Assessment
(DPIA) is required under UK GDPR Art. 35.

A DPIA is mandatory when processing is "likely to result in a high risk" to individuals. The ICO
identifies the following criteria that indicate high risk (a DPIA is required if **two or more**
criteria apply):

| Criterion | Applies? | Notes |
|-----------|----------|-------|
| Evaluation or scoring (including profiling) | ❌ No | ChainSolve does not profile users for automated decisions |
| Automated decision-making with legal or similarly significant effects | ❌ No | No automated decisions about users |
| Systematic monitoring of publicly accessible areas | ❌ No | Not applicable |
| Sensitive data (special categories under Art. 9/10) | ❌ No | No health, biometric, racial, religious, or criminal data is collected |
| Data processed on a large scale | ❌ No | Pre-release product; no scale at this time. Reassess at 10,000+ users |
| Matching or combining datasets | ❌ No | No cross-dataset matching for secondary purposes |
| Data concerning vulnerable subjects | ❌ No | Service explicitly excludes under-13/16s; not targeted at vulnerable groups |
| Innovative use of technology | ⚠️ Borderline | WASM computation engine is novel, but processes user-provided engineering data, not PII at scale |
| Transfer of data outside the EEA/UK with inadequate protection | ❌ No | All transfers use UK IDTA / SCCs (documented in ROPA) |

**Criteria count: 0 mandatory criteria apply. 1 borderline criterion (innovative technology) noted.**

---

## 2. Assessment Decision

**A full DPIA is NOT currently required.**

ChainSolve is a scientific node-graph calculator. It collects only the minimum personal data
necessary to operate a cloud-hosted application (account data, project storage, payment records,
security logs). It does not:

- Profile users
- Make automated decisions with legal or significant effects
- Process special category data
- Operate at large scale (pre-release)
- Systematically monitor individuals

The WebAssembly computation engine processes user-supplied numerical/scientific data, not personal
data. This does not constitute "innovative use of technology" in the GDPR sense (which refers to
technologies like facial recognition, location tracking, or biometric analysis).

---

## 3. Conditions That Would Require a DPIA

A DPIA will be required before implementing any of the following:

| Future Feature | Why a DPIA Would Be Needed |
|---------------|---------------------------|
| Profiling users based on calculation patterns | Evaluation/scoring criterion |
| Automated subscription tier recommendations | Automated decision-making criterion |
| Processing of health-related calculation data at scale | Sensitive data + large scale |
| Any form of user behaviour tracking beyond anonymised analytics | Systematic monitoring |
| Processing personal data for more than 100,000 users | Large scale criterion |
| Marketplace with user-generated content moderation | May involve systematic monitoring |

---

## 4. Next Review

This screening decision must be reviewed:

- **Annually** (next review: 2027-03-17)
- **Before** adding any new processing activity listed in Section 3
- **Before** expanding to more than 10,000 registered users

---

## 5. Sign-Off

| Role | Name | Date |
|------|------|------|
| Data Controller | Godfrey Engineering Ltd | 2026-03-17 |
| Reviewer | [To be named when DPO/legal counsel engaged] | |
