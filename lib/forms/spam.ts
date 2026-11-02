/**
 * Bot detection for the public lead forms.
 *
 * The site was being worked by a form-submission service — one of its own
 * leads advertised it: "a new platform that automates website form
 * submissions across thousands or even millions of websites". Roughly 85 of
 * the 103 real enquiries in production on 2026-09-23 came from it, in bursts
 * of two or three forms from one address within seconds of each other.
 *
 * What it looks like, from the rows it left:
 *
 *   name     mvIXjLAMSQcpjhWGgHhty        (random token)
 *   name     Xfbnlpp Lqckpzvd             (two random tokens, capitalised)
 *   message  6022055434                   (a phone number, in the message box)
 *   brief    Location: gtJDFsWehvQckZfjyzYqmPTa
 *   email    b.e.q.oya.d477@gmail.com     (dot-injected: one real mailbox)
 *   email    2meperkins@gmail.comempty    (its own template leaking)
 *
 * The tell that matters is not the gibberish, it is that EVERY field is
 * filled — a phone number in the message box is what a filler does when it
 * has run out of matching answers. That is what the honeypot below catches,
 * and it is why the honeypot is the primary defence rather than a heuristic
 * on the content: it keys on the behaviour, not on what the behaviour
 * happened to type this week.
 *
 * Deliberately NOT here:
 *
 * - **Gibberish scoring.** It reads well until you remember the site takes
 *   Arabic leads, where a Latin-vowel ratio is meaningless, and that a real
 *   name can be short, transliterated or initialled. The cost of a false
 *   positive is a silently discarded client; the cost of a false negative is
 *   a row an advisor deletes. Those are not symmetrical, and a heuristic that
 *   drops real leads to save a few clicks is a worse bug than the spam.
 * - **A CAPTCHA.** Friction on every visitor, a third-party key the client
 *   has to own past handover, and unnecessary while the cheap check works.
 *
 * `lib/rate-limit.ts` is the other half of this and is not a substitute: the
 * bot sent two or three requests and moved on, well inside a 10-per-minute
 * budget. (It did not run at all until 2 Nov 2026 — no `UPSTASH_*`
 * credentials were ever set — and now counts in Postgres instead.)
 *
 * On 2 Nov 2026 a second bot drove the real form in a browser, left the
 * honeypot alone and took its time. What stopped it is downstream of here:
 * the name and phone rules every intake schema applies
 * (`lib/contact-validation.ts`), the hourly and daily per-IP budgets in
 * `fileEnquiry`, and `isRepeatSender` below, which holds an address that
 * keeps coming back — that bot reused real people's addresses to have our
 * acknowledgement mailed to them.
 */

/**
 * The honeypot's field name.
 *
 * It must mean nothing to a browser. The first name, `_company_url`, read as
 * "company" to Chrome's, Safari's and the password managers' autofill, which
 * ignore `autocomplete="off"` on contact forms: a visitor who let their
 * browser fill in their details filled the trap too, was shown the thank-you,
 * and their lead was thrown away (found 2026-10-19 — every renderer form was
 * affected). A bot that fills every input fills this one whatever it is
 * called, so a name with no word an autofill heuristic knows costs the trap
 * nothing.
 *
 * Never put `name`, `email`, `phone`, `tel`, `company`, `organization`,
 * `business`, `address`, `url`, `website`, `city`, `zip` or `country` in it.
 */
export const HONEYPOT_FIELD = "_bz_hp";

/**
 * The name the honeypot shipped under until 2026-10-19.
 *
 * Still read, so a tab opened on an older deployment is judged the same way,
 * but no longer rendered. Safe to delete once no deployment that renders it
 * can still be open (Vercel's skew protection keeps one for 12 hours).
 */
export const LEGACY_HONEYPOT_FIELD = "_company_url";

/** The field carrying the moment the form was drawn. */
export const RENDERED_AT_FIELD = "_rendered_at";

/**
 * The floor on filling a form in, in milliseconds.
 *
 * Two seconds is well under a real submission — the shortest form still wants
 * a name, an email and a phone number — and well over a script's round trip.
 * It is set from what a human cannot do rather than from what a bot does, so
 * it does not need revising when the bot changes.
 */
export const MIN_FILL_MS = 2_000;

export type SpamVerdict =
  | { spam: false }
  | { spam: true; reason: "honeypot" | "too-fast" };

/** Why a lead was filed held: a form's own bot check, or intake's repeat-sender check. */
export type HeldReason = "honeypot" | "too-fast" | "repeat";

/**
 * How often one email address may file a lead before the next is held.
 *
 * The 2 Nov 2026 bot reused a handful of real people's addresses up to thirty
 * times a day, and each lead mailed that stranger our acknowledgement. A real
 * visitor sends one enquiry, sometimes two (a brochure and a callback, say);
 * a third inside the hour or a fourth inside the day is a script. It is held,
 * not refused: the visitor sees the same thank-you, and the desk can restore
 * it like any other held lead.
 */
export const REPEAT_LIMITS = [
  { windowMs: 60 * 60 * 1000, max: 2 },
  { windowMs: 24 * 60 * 60 * 1000, max: 3 },
] as const;

/**
 * Whether an address that already filed leads at these times is over a limit.
 *
 * `earlier` is the address's previous leads' creation times, newest or oldest
 * first — the order doesn't matter.
 */
export function isRepeatSender(earlier: readonly (string | Date)[], now: number = Date.now()): boolean {
  const times = earlier.map((t) => new Date(t).getTime()).filter(Number.isFinite);
  return REPEAT_LIMITS.some(({ windowMs, max }) => times.filter((t) => now - t < windowMs).length >= max);
}

type Submission = {
  /** Whatever arrived in the honeypot field, if anything. */
  honeypot?: unknown;
  /** Whatever arrived in the timestamp field, if anything. */
  renderedAt?: unknown;
  /** Injectable for tests. */
  now?: number;
};

function filled(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "boolean") return value;
  return String(value).trim().length > 0;
}

/**
 * Judge one submission.
 *
 * Absence is never evidence. A missing or unparseable timestamp is treated as
 * fine, because the honest ways to arrive without one are real — JavaScript
 * that has not run yet, a cached page, a browser extension that strips unknown
 * inputs — and the dishonest way is indistinguishable from them. The honeypot
 * carries the weight; timing only catches what is already in a hurry.
 */
export function classifySubmission(input: Submission): SpamVerdict {
  if (filled(input.honeypot)) return { spam: true, reason: "honeypot" };

  const rendered = Number(input.renderedAt);
  if (Number.isFinite(rendered) && rendered > 0) {
    const now = input.now ?? Date.now();
    const elapsed = now - rendered;
    // A negative elapsed time means clock skew between the visitor's machine
    // and ours, not a time traveller — it says nothing either way, so it is
    // left alone rather than counted against them.
    if (elapsed >= 0 && elapsed < MIN_FILL_MS) {
      return { spam: true, reason: "too-fast" };
    }
  }

  return { spam: false };
}

/**
 * Pull the two control values out of a raw payload and judge it, leaving the
 * payload itself untouched.
 */
export function classifyRawSubmission(
  raw: Record<string, unknown>,
  now?: number,
): SpamVerdict {
  return classifySubmission({
    honeypot: raw[HONEYPOT_FIELD] || raw[LEGACY_HONEYPOT_FIELD],
    renderedAt: raw[RENDERED_AT_FIELD],
    now,
  });
}

/** Strip the control fields, so they never reach a schema or a stored row. */
export function withoutSpamControls(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const rest = { ...raw };
  delete rest[HONEYPOT_FIELD];
  delete rest[LEGACY_HONEYPOT_FIELD];
  delete rest[RENDERED_AT_FIELD];
  return rest;
}

/**
 * What the desk reads on a lead the check held, in its internal notes.
 *
 * Written for the admin deciding whether to restore it, so it says what
 * tripped and what to do, not how the trap works.
 */
export function heldNote(reason: HeldReason): string {
  const why =
    reason === "honeypot"
      ? "a hidden field that only automated form-fillers can see was filled in"
      : reason === "repeat"
        ? "the same email address had already sent several enquiries in the last day"
        : `it was sent less than ${MIN_FILL_MS / 1000} seconds after the form appeared`;
  return (
    `Held by the website's spam check: ${why}. ` +
    "No acknowledgement was emailed and it was not sent to Salesforce. " +
    "If this is a real person, restore it — it then goes to Salesforce like any other lead."
  );
}
