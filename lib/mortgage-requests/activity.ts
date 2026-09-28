/**
 * A request's history as the CMS prints it (C2's Activity card, C6's contact
 * log): `mortgage_events` and `mortgage_contact_attempts` merged into one
 * newest-first list of lines, worded from the copy deck
 * (docs/mortgage/cms/00-foundations §11 "Activity lines are templates filled
 * from mortgage_events"). Pure, so the loaders and the tests share it.
 *
 * Contact attempts are read from their own table, which holds what the event
 * doesn't (the note, the call's length, inbound replies); their
 * `contact.logged` events are skipped so nothing shows twice. A status change
 * made by an action that has its own line — the first document opened, a
 * contact, a booking — is skipped too: the design's timeline never shows
 * "Moved to In review" under "Yasmin opened …".
 */

import { cmsT } from "./cms-strings";
import { formatActivityTime, formatBookedAt, formatCallDuration, formatDayMonth, firstNameOf } from "./cms-format";
import { formatMobile } from "./format";
import type { DocKind } from "./documents";

export type ActivityTone = "accent" | "success" | "danger" | "warn";

export type ActivityLine = {
  /** Stable key: the event's or the attempt's id. */
  id: string;
  at: string;
  /** "16:21", "Mon 18:20", "18 Sep". */
  time: string;
  text: string;
  /** The line is set in weight 500 (the design's `<b>` lines). */
  strong?: boolean;
  sub?: string;
  /** The sub-line is the applicant's or adviser's own words (C6 quotes them). */
  quote?: boolean;
  tone?: ActivityTone;
};

export type EventInput = {
  id: string;
  type: string;
  actor_kind: "applicant" | "staff" | "system" | "bank";
  actor_id: string | null;
  data: Record<string, unknown>;
  created_at: string;
};

export type ContactInput = {
  id: string;
  staff_id: string | null;
  channel: "call" | "whatsapp" | "email";
  outcome: "reached" | "no_answer" | "left_message" | "sent" | "received";
  body: string | null;
  duration_seconds: number | null;
  occurred_at: string;
};

export type ActivityContext = {
  service: "pre_approval" | "consultancy";
  applicantName: string;
  mobile: string;
  /** Staff display names by user id. */
  names: ReadonlyMap<string, string>;
  now: Date;
};

export const DOC_LABEL_KEY: Record<DocKind, string> = {
  emirates_id: "doc.emiratesId",
  passport: "doc.passport",
  salary_certificate: "doc.salaryCertificate",
  bank_statements_3m: "doc.bankStatements3m",
  trade_license: "doc.tradeLicense",
  bank_statements_12m: "doc.bankStatements12m",
};

export const STATUS_LABEL_KEY: Record<string, string> = {
  new: "status.new",
  in_review: "status.inReview",
  awaiting_applicant: "status.awaitingApplicant",
  with_banks: "status.withBanks",
  pre_approved: "status.preApproved",
  declined: "status.declined",
  contacted: "status.contacted",
  consultation_booked: "status.consultationBooked",
  completed: "status.completed",
};

/** Transitions whose action already has a line of its own. */
const QUIET_TRANSITIONS = new Set([
  "submitted",
  "first_document_opened",
  "contact_logged",
  "consultation_booked",
  "consultation_held",
]);

// The copy deck's keys are typed by next-intl; these lookups are by computed key.
const t = cmsT as unknown as (key: string, values?: Record<string, string | number>) => string;

function str(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function docLabel(kind: unknown): string {
  const key = typeof kind === "string" ? DOC_LABEL_KEY[kind as DocKind] : undefined;
  return key ? t(key) : String(kind ?? "");
}

function formatLabel(format: unknown): string {
  return format === "video" || format === "office" || format === "phone" ? t(`format.${format}`) : String(format ?? "");
}

export function describeEvent(e: EventInput, ctx: ActivityContext): ActivityLine | null {
  const base = { id: e.id, at: e.created_at, time: formatActivityTime(e.created_at, ctx.now) };
  const name = (id: string | null | undefined) => (id ? (ctx.names.get(id) ?? null) : null);
  // "{actor} is the first name" (00-foundations §11).
  const actor = firstNameOf(name(e.actor_id) ?? "Someone");

  switch (e.type) {
    case "request.submitted":
      return ctx.service === "consultancy"
        ? { ...base, text: t("activity.consultReceived.title"), sub: t("activity.consultReceived.sub"), tone: "accent" }
        : { ...base, text: t("activity.submitted.title"), sub: t("activity.submitted.sub"), tone: "accent" };
    case "owner.assigned": {
      const owner = firstNameOf(name(str(e.data.owner_staff_id)) ?? "Someone");
      if (e.data.via === "claim") return { ...base, text: t("activity.claimed", { owner }) };
      if (e.data.via === "reassign") {
        return { ...base, text: t("activity.reassigned.title", { owner }), sub: t("activity.reassigned.sub", { actor }) };
      }
      return { ...base, text: t("activity.assigned.title", { owner }), sub: t("activity.assigned.roundRobin") };
    }
    case "document.viewed":
      return { ...base, text: t("activity.opened", { actor, document: docLabel(e.data.kind) }) };
    case "document.downloaded":
      return { ...base, text: t("activity.downloaded", { actor, document: docLabel(e.data.kind) }) };
    case "document.accepted":
      return { ...base, text: t("activity.accepted", { actor, document: docLabel(e.data.kind) }), tone: "success" };
    case "consultation.booked": {
      const startsAt = str(e.data.starts_at);
      const adviser = name(str(e.data.adviser_staff_id)) ?? "";
      return {
        ...base,
        text: t("activity.booked.title", { actor, when: startsAt ? formatBookedAt(startsAt) : "" }),
        sub: t("activity.booked.sub", { format: formatLabel(e.data.format), adviser }),
        tone: "accent",
      };
    }
    case "consultation.held":
      return { ...base, text: t("activity.held", { actor }), tone: "success" };
    case "invite.sent": {
      const expires = str(e.data.expires_at);
      return {
        ...base,
        text: t("activity.inviteSent.title", { actor }),
        sub: expires ? t("activity.inviteSent.sub", { when: formatDayMonth(expires) }) : undefined,
      };
    }
    case "applicant.edited":
      return { ...base, text: t("activity.edited", { actor }) };
    case "sla.at_risk":
      return { ...base, text: t("activity.atRisk"), tone: "danger" };
    case "sla.breached":
      return { ...base, text: t("activity.breached"), tone: "danger" };
    case "status.changed": {
      if (QUIET_TRANSITIONS.has(String(e.data.event))) return null;
      const key = STATUS_LABEL_KEY[String(e.data.to)];
      return key ? { ...base, text: t("activity.statusChanged", { status: t(key) }) } : null;
    }
    default:
      // contact.logged comes from the attempts table; anything else (scanner
      // plumbing, purges) isn't part of the story the team reads.
      return null;
  }
}

export function describeContact(c: ContactInput, ctx: ActivityContext): ActivityLine {
  const base = { id: c.id, at: c.occurred_at, time: formatActivityTime(c.occurred_at, ctx.now) };
  const actor = firstNameOf((c.staff_id && ctx.names.get(c.staff_id)) || "Someone");
  const quote = c.body ? { sub: t("activity.quote", { text: c.body }), quote: true } : {};

  if (c.outcome === "received") {
    // Inbound (the WhatsApp webhook): the applicant's own words, in bold.
    return {
      ...base,
      // The deck's <b> is this line's weight, carried by `strong`.
      text: cmsT.markup("activity.whatsappIn", { firstName: firstNameOf(ctx.applicantName), b: (chunks) => chunks }),
      strong: true,
      tone: "accent",
      ...quote,
    };
  }
  if (c.channel === "call") {
    const key =
      c.outcome === "reached" ? "activity.callReached" : c.outcome === "left_message" ? "activity.callLeftMessage" : "activity.callNoAnswer";
    const mobile = formatMobile(ctx.mobile);
    return {
      ...base,
      text: t(key, { actor }),
      sub:
        c.duration_seconds != null
          ? t("activity.call.sub", { mobile, duration: formatCallDuration(c.duration_seconds) })
          : c.body
            ? t("activity.quote", { text: c.body })
            : mobile,
      quote: c.duration_seconds == null && !!c.body,
    };
  }
  if (c.channel === "whatsapp") return { ...base, text: t("activity.whatsappOut", { actor }), ...quote };
  return { ...base, text: t("activity.emailSent", { actor }), ...quote };
}

/**
 * Events and contact attempts as one timeline, newest first. The submit writes
 * its request and its round-robin assignment at the same instant; the
 * submission is always the oldest of those.
 */
export function buildActivity(
  events: readonly EventInput[],
  contacts: readonly ContactInput[],
  ctx: ActivityContext,
): ActivityLine[] {
  const lines: { line: ActivityLine; rank: number }[] = [];
  for (const e of events) {
    const line = describeEvent(e, ctx);
    if (line) lines.push({ line, rank: e.type === "request.submitted" ? 0 : 1 });
  }
  for (const c of contacts) lines.push({ line: describeContact(c, ctx), rank: 1 });
  return lines
    .sort((a, b) => b.line.at.localeCompare(a.line.at) || b.rank - a.rank || b.line.id.localeCompare(a.line.id))
    .map((x) => x.line);
}

/** The staff ids a history mentions, for one names lookup. */
export function staffIdsIn(events: readonly EventInput[], contacts: readonly ContactInput[]): string[] {
  const ids = new Set<string>();
  for (const e of events) {
    if (e.actor_id) ids.add(e.actor_id);
    for (const key of ["owner_staff_id", "adviser_staff_id", "from"]) {
      const v = str(e.data[key]);
      if (v && /^[0-9a-f-]{36}$/i.test(v)) ids.add(v);
    }
  }
  for (const c of contacts) if (c.staff_id) ids.add(c.staff_id);
  return [...ids];
}
