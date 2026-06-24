/**
 * Single source of truth for the legal disclaimer surfaced in the app UI
 * (Settings → About, and the dismissable index-page banner).
 *
 * Mirror of `docs/legal/disclaimer.md` so the in-app copy and the doc
 * copy can stay synchronized through code review. If you change one, change
 * the other.
 */

export const DISCLAIMER_TITLE = "Signatures from SignDocu are not legally binding";

export const DISCLAIMER_BODY = [
  "Signatures created by SignDocu provide a tamper-evident record and visual confirmation, but they do NOT meet the standards for legally binding electronic signatures under eIDAS (EU), the U.S. ESIGN Act, UETA, or comparable frameworks.",
  "For legally binding electronic signatures, use a qualified trust service provider (for example, DocuSign, Adobe Sign, or an eIDAS-certified provider in your jurisdiction).",
  "SignDocu is ideal for internal approvals, personal documents, mockups, and workflows where formal legal compliance is not required.",
] as const;

export const DISCLAIMER_SHORT = "Signatures from SignDocu are NOT legally binding. Tap for details.";

/** Stored keys (use a single key namespace so reset can clear all). */
export const DISCLAIMER_DISMISS_KEY = "draw-sign-pro-disclaimer-dismissed";
export const DISCLAIMER_ACK_KEY = "draw-sign-pro-disclaimer-acknowledged";
