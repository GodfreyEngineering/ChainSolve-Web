# Export Control Self-Classification

> **Document:** Export Control Assessment (16.70-16.72)
> **Data Controller:** Godfrey Engineering Ltd, Company No. 16845827
> **Last updated:** 2026-03-17
> **Review frequency:** Annually and when new cryptographic or dual-use features are added

---

## 1. UK Strategic Export Control Assessment

### Product Description

ChainSolve is a general-purpose scientific node-graph calculation workbench delivered as a web
application. It allows users to build, evaluate, and share computational graphs for engineering,
scientific, and mathematical calculations. The computation engine is implemented in Rust and
compiled to WebAssembly.

### UK Export Control Lists — Category 5 Part 2 (Information Security)

The UK Strategic Export Control Lists (SECL) Category 5 Part 2 controls "cryptographic software"
and related items. ChainSolve is assessed as follows:

| Criterion | Assessment |
|-----------|------------|
| Does ChainSolve implement proprietary cryptographic algorithms? | **No** — all cryptography is standard TLS/HTTPS provided by the browser and Cloudflare infrastructure. ChainSolve code does not implement any cryptographic primitives. |
| Does ChainSolve export, implement, or circumvent encryption controls? | **No** — ChainSolve does not process, transmit, or store encrypted data beyond standard HTTPS traffic. |
| Is ChainSolve designed or modified for use in weapons or military systems? | **No** |
| Does ChainSolve include controlled technology in Category 5 Part 2? | **No** |

**Assessment: ChainSolve does NOT contain controlled cryptographic functionality under the UK
Strategic Export Control Lists Category 5 Part 2.**

The HMAC-SHA256 webhook signing implemented in ChainSolve uses the Web Crypto API (`SubtleCrypto`)
for standard API authentication purposes. This is a standard internet security mechanism and is
explicitly excluded from export controls by the "mass market" and "publicly available software"
exemptions.

---

## 2. US Export Administration Regulations (EAR) Classification

ChainSolve is assessed as **EAR99** — not controlled under the Export Administration Regulations
(US Commerce Control List). General-purpose scientific calculation software with no custom
encryption implementation is typically classified EAR99.

This assessment is relevant when selling to US customers (universities, research institutions,
engineering firms). No export licence is required for EAR99 items.

---

## 3. ITAR (International Traffic in Arms Regulations)

ChainSolve is **not** designed, intended, or specifically configured for use with defence articles
or ITAR-controlled technical data.

**Disclaimer for enterprise/defence customers:** ChainSolve is a general-purpose scientific
calculation workbench. Users are solely responsible for ensuring that any technical data they input
into ChainSolve complies with applicable export control regulations, including ITAR. Godfrey
Engineering Ltd does not review or retain user calculation data for compliance purposes.

---

## 4. Conditions That Would Require Re-Assessment

This assessment must be updated before shipping the following features:

- Any proprietary cryptographic algorithm implementation
- End-to-end encrypted collaboration features
- Integration with classified or ITAR-controlled data sources
- Any feature specifically targeted at defence or weapons systems

---

## 5. References

- [UK Strategic Export Control Lists](https://www.gov.uk/government/collections/uk-strategic-export-control-lists-the-consolidated-list-of-strategic-military-and-dual-use-items-that-require-export-authorisation)
- [US Commerce Control List (EAR)](https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-774)
- [Mass Market Exemption — UK SECL Note 1](https://www.legislation.gov.uk/eudn/2009/43/annex)
