/**
 * Website copy that isn't final: messages/en/mortgage.json keys whose wording
 * design or compliance still owes (docs/mortgage/DECISIONS.md). The handoff
 * asked for undesigned states to ship as "clearly marked TODO strings"; JSON
 * can't carry a comment, so they are marked here, in one list, with the gap
 * that closes each. copy-status.test.ts keeps every key real.
 *
 * Launch is blocked until this list is empty or each entry is accepted as is.
 */

export type PendingCopy = {
  /** Keys under the `mortgage` namespace; a trailing `.*` covers a whole group. */
  key: string;
  /** The decision or gap that settles it. */
  gap: string;
  note: string;
};

export const PENDING_COPY: readonly PendingCopy[] = [
  // D11a: the promise is 24 WORKING hours. Design rewords these; until then
  // they are the designed text, which reads as calendar time.
  { key: "w1.preApproval.badge", gap: "D11a", note: "Says 24 hours; the clock runs on working hours" },
  { key: "w1.preApproval.desc", gap: "D11a", note: "Says 24 hours; the clock runs on working hours" },
  { key: "preNext.contact", gap: "D11a", note: "Says 24 hours; the clock runs on working hours" },
  { key: "w7.due.note", gap: "D11a", note: "Says 24 hours; the clock runs on working hours" },
  // Compliance.
  { key: "consent.label", gap: "D2 / FE-11", note: "Wording v0.1; lib/mortgage-requests/consent.ts holds the stored copy" },
  { key: "consent.pending", gap: "D2 / FE-11", note: "Remove once compliance signs the wording off" },
  { key: "security.body", gap: "D17", note: "Each clause needs its control checked (SPEC §8)" },
  // D27: are these real?
  { key: "shell.permit", gap: "D27 / FE-12", note: "Permit number from the design" },
  { key: "shell.footer.phone", gap: "D27 / FE-12", note: "Phone number from the design" },
  { key: "w1.contact", gap: "D27 / FE-12", note: "Phone and WhatsApp numbers from the design" },
  // FE-1: never designed; written in the house style.
  { key: "w2.error.*", gap: "FE-1", note: "W2 validation messages" },
  { key: "upload.error.*", gap: "FE-1", note: "Upload errors; only upload.error.tooLarge was designed" },
  { key: "submit.*", gap: "FE-1", note: "Submit errors and the sending state" },
  { key: "docs.error.*", gap: "FE-1", note: "The draft couldn't be created" },
  { key: "docs.expired", gap: "FE-1", note: "The draft expired and was replaced" },
  { key: "docs.note.consent", gap: "FE-1", note: "All documents ready, consent not ticked" },
  { key: "doc.emiratesId.noun", gap: "FE-1", note: "Only the licence's noun was designed" },
  { key: "doc.passport.noun", gap: "FE-1", note: "Only the licence's noun was designed" },
  { key: "w2.cta.consultancy", gap: "W2 open question", note: "Consultancy's CTA label" },
  { key: "docs.monthsRange", gap: "W6", note: "The designed \"Sep 2025 to Aug 2026\", as a message" },
  // Accessibility text the designs don't show.
  { key: "stepper.label", gap: "a11y", note: "Accessible name of the stepper" },
  { key: "stepper.done", gap: "a11y", note: "Read after a completed step" },
  { key: "w2.mobile.label", gap: "a11y", note: "\"Mobile number, +971\"" },
  { key: "upload.remove", gap: "a11y", note: "The ✕ on a file" },
  { key: "upload.cancelFile", gap: "a11y", note: "The ✕ on an uploading file" },
  { key: "upload.progressLabel", gap: "a11y", note: "The progress bar's name" },
  { key: "upload.announce.*", gap: "a11y", note: "The upload rows' live region" },
  { key: "upload.pickerLabel", gap: "a11y", note: "The hidden file input's name" },
  { key: "upload.leaveWarning", gap: "a11y", note: "Browsers show their own text for beforeunload; kept for the in-app exit" },
  { key: "upload.retry", gap: "FE-1", note: "Retry after a network error" },
  // Decided deviations from the handoff's text.
  { key: "doc.tradeLicense.name", gap: "D28", note: "\"license\" → \"licence\" (decided: UAE spelling everywhere)" },
  { key: "residency.uaeNational.sub", gap: "D23", note: "\"Up to 85% LTV\" with the figure from mortgage_settings" },
  { key: "residency.expat.sub", gap: "D23", note: "\"Up to 80% LTV\" with the figure from mortgage_settings" },
  { key: "docs.note.attention", gap: "i18n", note: "Split from docs.note.progress: the catalogue forbids a plural inside a sentence" },
];
