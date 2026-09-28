import { describe, expect, it } from "vitest";
import {
  ACTOR_KINDS,
  IllegalTransitionError,
  STAFF_EVENTS,
  STATUSES_BY_SERVICE,
  TRANSITION_EVENTS,
  canTransition,
  isClosed,
  nextStatus,
  type ActorKind,
  type ClockEffect,
  type MortgageService,
  type MortgageStatus,
  type TransitionContext,
  type TransitionEvent,
} from "./state";

const READY_FOR_BANKS: TransitionContext = {
  acceptedDocuments: 4,
  requiredDocuments: 4,
  consentOnFile: true,
  bankSubmissions: 1,
};

// Every allowed move in SPEC §2.4, after creation.
const ALLOWED: [MortgageService, MortgageStatus, TransitionEvent, ActorKind, TransitionContext, MortgageStatus, ClockEffect][] = [
  ["pre_approval", "new", "first_document_opened", "system", {}, "in_review", null],
  ["pre_approval", "in_review", "reupload_requested", "staff", {}, "awaiting_applicant", "pause"],
  ["pre_approval", "awaiting_applicant", "reupload_requested", "staff", {}, "awaiting_applicant", null],
  ["pre_approval", "awaiting_applicant", "reupload_fulfilled", "applicant", { outstandingReuploads: 0 }, "in_review", "resume"],
  ["pre_approval", "awaiting_applicant", "reupload_fulfilled", "applicant", { outstandingReuploads: 1 }, "awaiting_applicant", null],
  ["pre_approval", "awaiting_applicant", "reupload_cancelled", "staff", { outstandingReuploads: 0 }, "in_review", "resume"],
  ["pre_approval", "in_review", "sent_to_banks", "staff", READY_FOR_BANKS, "with_banks", null],
  ["pre_approval", "with_banks", "pre_approved", "staff", {}, "pre_approved", "stop"],
  // D19: declining before the banks, as well as after.
  ["pre_approval", "new", "declined", "staff", {}, "declined", "stop"],
  ["pre_approval", "in_review", "declined", "staff", {}, "declined", "stop"],
  ["pre_approval", "awaiting_applicant", "declined", "staff", {}, "declined", "stop"],
  ["pre_approval", "with_banks", "declined", "staff", {}, "declined", "stop"],
  ["consultancy", "new", "contact_logged", "staff", {}, "contacted", null],
  ["consultancy", "contacted", "contact_logged", "staff", {}, "contacted", null],
  ["consultancy", "consultation_booked", "contact_logged", "staff", {}, "consultation_booked", null],
  ["consultancy", "contacted", "consultation_booked", "staff", {}, "consultation_booked", null],
  ["consultancy", "consultation_booked", "consultation_held", "staff", {}, "completed", null],
];

describe("allowed transitions (SPEC §2.4)", () => {
  it.each(ALLOWED)("%s: %s --%s (%s)-->", (service, from, event, actor, ctx, to, clock) => {
    expect(nextStatus(service, from, event, actor, ctx)).toEqual({ to, clock });
  });

  it("pauses the clock only on entering awaiting_applicant, resumes it only on leaving, stops it only on a decision", () => {
    const effects = ALLOWED.map(([, from, , , , to, clock]) => ({ from, to, clock }));
    for (const { from, to, clock } of effects) {
      if (clock === "pause") expect([from, to]).toEqual(["in_review", "awaiting_applicant"]);
      if (clock === "resume") expect([from, to]).toEqual(["awaiting_applicant", "in_review"]);
      if (clock === "stop") expect(["pre_approved", "declined"]).toContain(to);
    }
  });
});

describe("illegal transitions", () => {
  const ILLEGAL: [MortgageService, MortgageStatus, TransitionEvent, ActorKind, TransitionContext?][] = [
    // Skipping steps.
    ["pre_approval", "new", "sent_to_banks", "staff", READY_FOR_BANKS],
    ["pre_approval", "new", "pre_approved", "staff"],
    ["pre_approval", "in_review", "pre_approved", "staff"],
    ["consultancy", "new", "consultation_booked", "staff"],
    ["consultancy", "contacted", "consultation_held", "staff"],
    // A decision is final, and only the team makes it.
    ["pre_approval", "declined", "declined", "staff"],
    ["pre_approval", "pre_approved", "declined", "staff"],
    ["pre_approval", "in_review", "declined", "system"],
    ["consultancy", "contacted", "declined", "staff"],
    // Nothing moves a closed request.
    ["pre_approval", "pre_approved", "reupload_requested", "staff"],
    ["pre_approval", "declined", "sent_to_banks", "staff", READY_FOR_BANKS],
    ["consultancy", "completed", "contact_logged", "staff"],
    // Events from the other service.
    ["pre_approval", "new", "contact_logged", "staff"],
    ["consultancy", "new", "first_document_opened", "system"],
    // Re-uploads only while in review or awaiting.
    ["pre_approval", "with_banks", "reupload_requested", "staff"],
    ["pre_approval", "in_review", "reupload_fulfilled", "applicant", { outstandingReuploads: 0 }],
    // The wrong actor.
    ["pre_approval", "awaiting_applicant", "reupload_fulfilled", "staff", { outstandingReuploads: 0 }],
    ["pre_approval", "in_review", "reupload_requested", "applicant"],
    ["pre_approval", "new", "first_document_opened", "staff"],
    ["pre_approval", "with_banks", "pre_approved", "bank"],
  ];

  it.each(ILLEGAL)("%s: %s --%s (%s)--> refused", (service, from, event, actor, ctx) => {
    expect(() => nextStatus(service, from, event, actor, ctx ?? {})).toThrow(IllegalTransitionError);
    expect(canTransition(service, from, event, actor, ctx ?? {})).toBe(false);
  });

  it("guards sending to banks: all documents accepted, consent on file, at least one bank", () => {
    const send = (ctx: TransitionContext) => () =>
      nextStatus("pre_approval", "in_review", "sent_to_banks", "staff", ctx);
    expect(send({ ...READY_FOR_BANKS, acceptedDocuments: 3 })).toThrow("every document must be accepted first");
    expect(send({ ...READY_FOR_BANKS, requiredDocuments: 0, acceptedDocuments: 0 })).toThrow(
      "every document must be accepted first",
    );
    expect(send({ ...READY_FOR_BANKS, consentOnFile: false })).toThrow("consent is not on file");
    expect(send({ ...READY_FOR_BANKS, bankSubmissions: 0 })).toThrow("at least one bank");
  });

  it("answers every status × event × actor with an outcome or IllegalTransitionError, nothing else", () => {
    const ctx: TransitionContext = { ...READY_FOR_BANKS, outstandingReuploads: 0 };
    let allowed = 0;
    for (const service of ["pre_approval", "consultancy"] as const) {
      for (const from of STATUSES_BY_SERVICE[service]) {
        for (const event of TRANSITION_EVENTS) {
          for (const actor of ACTOR_KINDS) {
            if (canTransition(service, from, event, actor, ctx)) allowed++;
          }
        }
      }
    }
    // The rows of ALLOWED, less the one that differs only by outstanding re-uploads.
    expect(allowed).toBe(ALLOWED.length - 1);
  });
});

describe("helpers", () => {
  it("lists the events only the mortgage team can fire", () => {
    expect([...STAFF_EVENTS].sort()).toEqual(
      [
        "consultation_booked",
        "consultation_held",
        "contact_logged",
        "declined",
        "pre_approved",
        "reupload_cancelled",
        "reupload_requested",
        "sent_to_banks",
      ].sort(),
    );
  });

  it("closes pre_approved, declined and completed", () => {
    expect(isClosed("pre_approved")).toBe(true);
    expect(isClosed("declined")).toBe(true);
    expect(isClosed("completed")).toBe(true);
    expect(isClosed("with_banks")).toBe(false);
  });
});
