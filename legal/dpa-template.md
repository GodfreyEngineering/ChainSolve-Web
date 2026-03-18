# Data Processing Addendum (DPA) — Template

**Version:** 1.0
**Effective date:** 17 March 2026

> **Note:** This template is provided for enterprise customers who require a
> signed Data Processing Addendum as part of their procurement process. To
> execute this DPA, complete the details in the square brackets below and
> email the completed document to support@chainsolve.co.uk. We will countersign
> and return the executed copy within 5 business days.

---

## PARTIES

This Data Processing Addendum ("DPA") supplements and is incorporated into the
ChainSolve Terms of Service between:

**Data Processor:**
Godfrey Engineering Ltd
Registered in England and Wales (Company No. 16845827)
Email: support@chainsolve.co.uk
("ChainSolve", "Processor")

**Data Controller:**
[Customer legal entity name]
[Registered address]
[Registration number, if applicable]
[Contact email]
("Customer", "Controller")

---

## 1. Definitions

In this DPA:

- **"GDPR"** means the UK GDPR (as defined in the Data Protection Act 2018)
  and, where applicable, EU Regulation 2016/679.
- **"Personal Data"** has the meaning given in the GDPR.
- **"Processing"** has the meaning given in the GDPR.
- **"Data Subject"** has the meaning given in the GDPR.
- **"Sub-processor"** means any third party that ChainSolve engages to Process
  Personal Data on the Controller's behalf.
- **"Services"** means the ChainSolve web application and associated services
  described in the Terms of Service.

---

## 2. Scope and Nature of Processing

### 2.1 Subject matter

ChainSolve processes Personal Data on behalf of the Controller solely to
provide the Services described in the Terms of Service.

### 2.2 Categories of Data Subjects

End users of the Controller's ChainSolve accounts (employees, contractors,
students, or other authorised users designated by the Controller).

### 2.3 Categories of Personal Data

| Category | Examples |
|----------|---------|
| Identity data | Name (if provided), email address |
| Account data | User ID, authentication tokens, account preferences |
| Usage data | Calculation graphs, uploaded data files, usage logs |
| Technical data | IP addresses, browser/device information, session data |
| Payment data | Stripe Customer ID, subscription status (not card numbers) |

### 2.4 Special Categories of Personal Data

ChainSolve does not knowingly process any special category data (health,
biometric, political, religious, or genetic data) as part of the Services.
The Controller must not upload special category data unless separately agreed
in writing.

### 2.5 Duration

For the duration of the Terms of Service and until deletion of Personal Data
in accordance with Section 6 of this DPA.

---

## 3. Obligations of the Processor

ChainSolve will:

a. Process Personal Data only on documented instructions from the Controller
   (as set out in the Terms of Service and this DPA), unless required to do
   so by applicable law;

b. Ensure that persons authorised to process Personal Data have committed
   themselves to confidentiality or are under an appropriate statutory
   obligation of confidentiality;

c. Implement appropriate technical and organisational measures to ensure a
   level of security appropriate to the risk, including as appropriate:
   - Encryption of Personal Data in transit (TLS 1.2+) and at rest (AES-256)
   - Ability to ensure ongoing confidentiality, integrity, availability, and
     resilience of processing systems and services
   - Ability to restore availability and access to Personal Data in a timely
     manner in the event of a physical or technical incident
   - A process for regularly testing, assessing, and evaluating the
     effectiveness of technical and organisational measures

d. Respect the conditions for engaging Sub-processors (Section 4);

e. Taking into account the nature of the processing, assist the Controller
   by appropriate technical and organisational measures to fulfil obligations
   to respond to requests to exercise Data Subject rights;

f. Assist the Controller in ensuring compliance with its obligations under
   Arts. 32-36 GDPR, including security, breach notification, DPIAs, and
   prior consultation with supervisory authorities;

g. At the Controller's choice, delete or return all Personal Data after the
   end of the provision of services, and delete existing copies unless
   storage is required by law;

h. Make available all information necessary to demonstrate compliance with
   this DPA and allow for and contribute to audits conducted by the
   Controller or an auditor mandated by the Controller (with reasonable
   notice and at the Controller's cost).

---

## 4. Sub-processors

### 4.1 Authorised Sub-processors

The Controller provides general authorisation for ChainSolve to engage the
following Sub-processors:

| Sub-processor | Purpose | Data location |
|---------------|---------|---------------|
| Supabase Inc. | Database, authentication, storage | AWS EU-West-1 (Ireland) / US-East-1 |
| Stripe Inc. | Payment processing | US (UK IDTA SCCs in place) |
| Resend Inc. | Transactional email | US (UK IDTA SCCs in place) |
| Cloudflare Inc. | CDN, DDoS protection, hosting | Global (UK IDTA SCCs in place) |
| Sentry (Functional Software Inc.) | Error tracking | US (UK IDTA SCCs in place) |

Full DPA references are maintained at `legal/dpa-references.md` in the
ChainSolve repository.

### 4.2 Changes to Sub-processors

ChainSolve will give the Controller at least 30 days' prior written notice
of any intended changes to Sub-processors. The Controller may object to such
changes within 14 days. If the Controller objects and ChainSolve cannot
reasonably accommodate the objection, the Controller may terminate the Terms
of Service upon 30 days' notice.

---

## 5. International Data Transfers

Where ChainSolve transfers Personal Data outside the UK or EEA, it will
ensure an appropriate transfer mechanism is in place, including:

- UK IDTA (International Data Transfer Agreement) for transfers from the UK
- EU Standard Contractual Clauses (SCCs) for transfers from the EEA

The specific transfer mechanisms for each Sub-processor are documented in
`legal/dpa-references.md`.

---

## 6. Data Retention and Deletion

ChainSolve will:

- Retain Personal Data for the duration of the active subscription
- Delete Personal Data within 30 days of receiving a deletion request from
  the Controller or upon account termination
- Retain financial records (Stripe transaction data) for 7 years as required
  by HMRC, even after account deletion
- Retain aggregated, anonymised usage analytics indefinitely (no Personal
  Data retained in anonymised aggregates)

---

## 7. Security Incident Notification

In the event of a Personal Data breach affecting the Controller's data,
ChainSolve will:

- Notify the Controller without undue delay (and where feasible within 48
  hours) of becoming aware of the breach
- Provide sufficient information to enable the Controller to comply with its
  own breach notification obligations under Art. 33 GDPR
- Cooperate with the Controller in investigating and remedying the breach

---

## 8. Controller Obligations

The Controller confirms that:

a. It has a lawful basis for Processing Personal Data and instructing
   ChainSolve to Process it on its behalf;

b. It has provided all necessary notices and obtained all necessary consents
   from Data Subjects;

c. It will not instruct ChainSolve to Process Personal Data in a way that
   violates the GDPR or other applicable law;

d. It is responsible for ensuring that its end users comply with the
   ChainSolve Terms of Service.

---

## 9. Liability

Each party's liability under this DPA is subject to the limitations set out
in the Terms of Service. ChainSolve's aggregate liability for breaches of
this DPA shall not exceed the amount the Controller paid to ChainSolve in
the 12 months preceding the claim.

---

## 10. Governing Law

This DPA is governed by the laws of England and Wales. Disputes shall be
subject to the exclusive jurisdiction of the courts of England and Wales.

---

## 11. Order of Precedence

In the event of any conflict between this DPA and the Terms of Service, this
DPA prevails with respect to data protection matters only.

---

## EXECUTION

**Data Controller:**

| Field | Value |
|-------|-------|
| Legal entity name | [____________] |
| Signatory name | [____________] |
| Signatory title | [____________] |
| Signature | [____________] |
| Date | [____________] |

**Data Processor (Godfrey Engineering Ltd):**

| Field | Value |
|-------|-------|
| Signatory name | Ben Godfrey |
| Signatory title | Director |
| Signature | [to be completed upon receipt] |
| Date | [to be completed upon receipt] |

---

*To execute this DPA, email the completed document to support@chainsolve.co.uk
with subject "DPA Execution Request — [Your Organisation Name]".*
