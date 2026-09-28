/**
 * Mortgage request statuses and the moves between them
 * (docs/mortgage/SPEC.md §2.4).
 *
 * The database is the authority: `mortgage_transition()` (migration 0139)
 * validates each move and writes the status with its event in one
 * transaction, and a trigger rejects any other write to `status`. This module
 * mirrors its table so the UI can tell which actions are open and the unit
 * tests can pin the rules. The database tests check the two agree on every
 * status × event pair.
 *
 * The request's creation (— → new) is `mortgage_create_request()`, not a
 * transition here.
 */

export const MORTGAGE_SERVICES = ["consultancy", "pre_approval"] as const;
export type MortgageService = (typeof MORTGAGE_SERVICES)[number];

export const PRE_APPROVAL_STATUSES = [
  "new",
  "in_review",
  "awaiting_applicant",
  "with_banks",
  "pre_approved",
  "declined",
] as const;
export const CONSULTANCY_STATUSES = ["new", "contacted", "consultation_booked", "completed"] as const;

export type MortgageStatus =
  | (typeof PRE_APPROVAL_STATUSES)[number]
  | (typeof CONSULTANCY_STATUSES)[number];

export const STATUSES_BY_SERVICE: Record<MortgageService, readonly MortgageStatus[]> = {
  pre_approval: PRE_APPROVAL_STATUSES,
  consultancy: CONSULTANCY_STATUSES,
};

/** C1's Closed tab. */
export const CLOSED_STATUSES: readonly MortgageStatus[] = ["pre_approved", "declined", "completed"];

export function isClosed(status: MortgageStatus): boolean {
  return CLOSED_STATUSES.includes(status);
}

export const ACTOR_KINDS = ["applicant", "staff", "system", "bank"] as const;
export type ActorKind = (typeof ACTOR_KINDS)[number];

export const TRANSITION_EVENTS = [
  "first_document_opened",
  "reupload_requested",
  "reupload_fulfilled",
  "reupload_cancelled",
  "sent_to_banks",
  "pre_approved",
  "declined",
  "contact_logged",
  "consultation_booked",
  "consultation_held",
] as const;
export type TransitionEvent = (typeof TRANSITION_EVENTS)[number];

/** What a move does to the 24-hour promise (SPEC §2.5). */
export type ClockEffect = "pause" | "resume" | "stop" | null;

export type TransitionOutcome = { to: MortgageStatus; clock: ClockEffect };

/**
 * Facts the guarded moves depend on. The database computes them from its own
 * tables; callers of `nextStatus` supply them.
 */
export type TransitionContext = {
  /** Re-upload requests still open once this event's own bookkeeping is done. */
  outstandingReuploads?: number;
  acceptedDocuments?: number;
  requiredDocuments?: number;
  consentOnFile?: boolean;
  bankSubmissions?: number;
};

export class IllegalTransitionError extends Error {
  /** The SQLSTATE `mortgage_transition()` raises for the same case. */
  readonly code = "MR422";
  constructor(message: string) {
    super(message);
    this.name = "IllegalTransitionError";
  }
}

type Rule = {
  service: MortgageService;
  from: readonly MortgageStatus[];
  event: TransitionEvent;
  actor: ActorKind;
  outcome: (from: MortgageStatus, ctx: TransitionContext) => TransitionOutcome;
};

const to =
  (status: MortgageStatus, clock: ClockEffect = null) =>
  (): TransitionOutcome => ({ to: status, clock });

/** The applicant sent the re-upload, or staff cancelled the request for it. */
function leaveAwaiting(_from: MortgageStatus, ctx: TransitionContext): TransitionOutcome {
  if (ctx.outstandingReuploads === undefined) {
    throw new Error("leaving awaiting_applicant needs outstandingReuploads");
  }
  // Two documents flagged, one returned: still waiting on the other, clock still paused.
  return ctx.outstandingReuploads > 0
    ? { to: "awaiting_applicant", clock: null }
    : { to: "in_review", clock: "resume" };
}

/** Accept application (4 of 4 accepted) and send to ≥ 1 bank. */
function sendToBanks(_from: MortgageStatus, ctx: TransitionContext): TransitionOutcome {
  const required = ctx.requiredDocuments ?? 0;
  if (required === 0 || (ctx.acceptedDocuments ?? 0) < required) {
    throw new IllegalTransitionError("every document must be accepted first");
  }
  if (!ctx.consentOnFile) throw new IllegalTransitionError("consent is not on file");
  if ((ctx.bankSubmissions ?? 0) === 0) {
    throw new IllegalTransitionError("send the package to at least one bank");
  }
  return { to: "with_banks", clock: null };
}

/** Must match the table in `mortgage_transition()`, migration 0139. */
export const TRANSITIONS: readonly Rule[] = [
  // Fast Pre-Approval
  { service: "pre_approval", from: ["new"], event: "first_document_opened", actor: "system", outcome: to("in_review") },
  { service: "pre_approval", from: ["in_review"], event: "reupload_requested", actor: "staff", outcome: to("awaiting_applicant", "pause") },
  // A second document flagged while the first is still out: the clock is already paused.
  { service: "pre_approval", from: ["awaiting_applicant"], event: "reupload_requested", actor: "staff", outcome: to("awaiting_applicant") },
  { service: "pre_approval", from: ["awaiting_applicant"], event: "reupload_fulfilled", actor: "applicant", outcome: leaveAwaiting },
  { service: "pre_approval", from: ["awaiting_applicant"], event: "reupload_cancelled", actor: "staff", outcome: leaveAwaiting },
  { service: "pre_approval", from: ["in_review"], event: "sent_to_banks", actor: "staff", outcome: sendToBanks },
  { service: "pre_approval", from: ["with_banks"], event: "pre_approved", actor: "staff", outcome: to("pre_approved", "stop") },
  { service: "pre_approval", from: ["with_banks"], event: "declined", actor: "staff", outcome: to("declined", "stop") },
  // Mortgage Consultancy
  { service: "consultancy", from: ["new"], event: "contact_logged", actor: "staff", outcome: to("contacted") },
  // Later attempts are logged without moving the request.
  { service: "consultancy", from: ["contacted", "consultation_booked"], event: "contact_logged", actor: "staff", outcome: (from) => ({ to: from, clock: null }) },
  { service: "consultancy", from: ["contacted"], event: "consultation_booked", actor: "staff", outcome: to("consultation_booked") },
  { service: "consultancy", from: ["consultation_booked"], event: "consultation_held", actor: "staff", outcome: to("completed") },
];

/** Events that only a member of the mortgage team can fire. */
export const STAFF_EVENTS: ReadonlySet<TransitionEvent> = new Set(
  TRANSITIONS.filter((r) => r.actor === "staff").map((r) => r.event),
);

/**
 * Where `event` takes a request, and what it does to the clock. Throws
 * `IllegalTransitionError` for a move SPEC §2.4 doesn't allow, from this actor
 * or at all.
 */
export function nextStatus(
  service: MortgageService,
  from: MortgageStatus,
  event: TransitionEvent,
  actor: ActorKind,
  ctx: TransitionContext = {},
): TransitionOutcome {
  const rule = TRANSITIONS.find(
    (r) => r.service === service && r.event === event && r.from.includes(from),
  );
  if (!rule) {
    throw new IllegalTransitionError(`illegal transition: ${event} from ${from} (${service})`);
  }
  if (rule.actor !== actor) {
    throw new IllegalTransitionError(`event ${event} cannot come from a ${actor} actor`);
  }
  return rule.outcome(from, ctx);
}

/** `nextStatus` as a yes/no, for enabling a button. */
export function canTransition(
  service: MortgageService,
  from: MortgageStatus,
  event: TransitionEvent,
  actor: ActorKind,
  ctx: TransitionContext = {},
): boolean {
  try {
    nextStatus(service, from, event, actor, ctx);
    return true;
  } catch (error) {
    if (error instanceof IllegalTransitionError) return false;
    throw error;
  }
}
