# ICO Registration — UK Data Controller (Item 16.46)

## Status

**ACTION REQUIRED before launch.**
Registration number: *(to be completed after registration)*

---

## What this is

Under the UK GDPR and Data Protection Act 2018, organisations that process personal data
for purposes other than purely personal/household reasons must register with the
**Information Commissioner's Office (ICO)** as a data controller — unless they qualify
for an exemption.

ChainSolve processes:
- Account credentials (email, hashed password) — to provide authentication
- Usage data and project content — to provide the service
- Billing information (via Stripe) — to process payments

This processing is not purely personal/household, so registration is **required**.

---

## Cost

| Organisation size | Annual fee |
| --- | --- |
| Micro (< 10 staff, turnover ≤ £632,000) | **£40** |
| Small (< 250 staff, turnover ≤ £36M) | £60 |
| All others | £2,900 |

ChainSolve at launch qualifies for the **micro-organisation fee of £40/yr**.

---

## How to register

1. Go to **https://ico.org.uk/registration**
2. Click "Register as a data controller"
3. Complete the online self-assessment (select the correct fee tier)
4. Pay the £40 annual fee by card or Direct Debit
5. You will receive your **ICO registration number** (format: `ZxxxxxxX`) immediately

Total time: ~15 minutes.

---

## After registration

1. **Add the ICO number to this file** — update the "Status" section above.
2. **Add the ICO number to the Privacy Policy** — search `public/legal/privacy-policy.html`
   for `<!-- ICO_REGISTRATION_NUMBER -->` and replace with your number.
3. **Store the registration confirmation email** in this directory as
   `ico-registration-confirmation.pdf`.
4. **Set a calendar reminder** to renew annually (renewal is automatic if Direct Debit
   is set up, otherwise a reminder email is sent ~30 days before expiry).

---

## Exemptions check

The ICO provides a self-assessment tool to check if you are exempt. ChainSolve does not
qualify for an exemption because:
- We process personal data of people other than our own employees/volunteers.
- The processing is for commercial purposes (subscription SaaS).
- We are not a public authority, charity, or member association qualifying for reduced fees.

---

## References

- ICO Registration: https://ico.org.uk/for-organisations/ico-registration/
- ICO Self-Assessment: https://ico.org.uk/for-organisations/ico-registration/do-i-need-to-pay-the-data-protection-fee/
- Data Protection Act 2018, s.137 (the fee framework)
