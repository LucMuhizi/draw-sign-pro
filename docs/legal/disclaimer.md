# SignDocu Legal Disclaimer

> **Source of truth mirrored in [`src/lib/disclaimer.ts`](../../src/lib/disclaimer.ts).**
> If you change this file, update the code constant in the same PR. They must stay in sync.

## Signatures from SignDocu are not legally binding

Signatures created by SignDocu provide a tamper-evident record
(SHA-256 hash, signed-at timestamp, per-signature audit log embedded in the
appended certificate of completion) and a visual confirmation. They do **not**
meet the standards for legally binding electronic signatures under:

- **eIDAS** (EU Regulation on Electronic Identification and Trust Services)
- **The U.S. ESIGN Act** (Electronic Signatures in Global and National Commerce)
- **UETA** (Uniform Electronic Transactions Act, US states)
- Comparable frameworks in other jurisdictions

For legally binding electronic signatures, use a **qualified trust service
provider**, for example:

- DocuSign
- Adobe Sign / Acrobat Sign
- An eIDAS-certified Qualified Electronic Signature (QES) provider in your jurisdiction

SignDocu is ideal for:

- Internal approvals
- Personal documents and informal agreements
- Mockups and contract templates
- Workflows where formal legal compliance is not required
- Educational use cases

## Why we make this explicit

If your jurisdiction requires a qualified electronic signature for a given
document category (wills, certain real-estate transfers, court filings,
notarization, etc.) and you sign that document with SignDocu, the result
**may not be enforceable**. The app's own audit certificate explicitly says:

> This certificate does NOT constitute a legally binding digital signature
> under eIDAS, ESIGN Act, or UETA.

The mobile app surfaces this disclaimer:

1. **First-run dismissable banner** above the upload screen.
2. **Settings → About → Legal notice** (always visible after first dismissal).

## Data we never collect

SignDocu does not transmit document content, signature images, or signing
metadata to any server without your explicit opt-in. Cloud sync is off by
default. See [Privacy](../PRIVACY_AND_DATA.md) (TODO) for the full data flow.

---

_Last updated: 2026-06-23_
