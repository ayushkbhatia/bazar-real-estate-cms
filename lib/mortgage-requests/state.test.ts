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

const RUNNING: TransitionContext = { clockRunning: true };
const PAUSED: TransitionContext = { clockPaused: true, outstandingReuploads: 0 };

// Every allowed move in SPEC §2.4 as amended by 0158, after creation.
const ALLOWED: [MortgageService, MortgageStatus, TransitionEvent, ActorKind, TransitionContext, MortgageStatus, ClockEffect][] = [
  // Opening a document no longer moves the file.
  ["pre_approval", "open", "first_document_opened", "system", {}, "open", null],
  // A re-upload request pauses a running clock and leaves the stage alone.
  ["pre_approval", "open", "reupload_requested", "staff", RUNNING, "open", "pause"],
  ["pre_approval", "open", "reupload_requested", "staff", {}, "open", null],
  ["pre_approval", "open", "reupload_fulfilled", "applicant", PAUSED, "open", "resume"],
  ["pre_approval", "open", "reupload_fulfilled", "applicant", { clockPaused: true, outstandingReuploads: 1 }, "open", null],
  ["pre_approval", "open", "reupload_cancelled", "staff", PAUSED, "open", "resume"],
  // Any stage to any stage; a declined file moved onto a stage is reopened.
  ["pre_approval", "open", "stage_changed", "staff", {}, "open", "stage"],
  ["pre_approval", "declined", "stage_changed", "staff", {}, "open", "stage"],
  // D19: declined from any stage.
  ["pre_approval", "open", "declined", "staff", {}, "declined", "stop"],
  ["consultancy", "new", "contact_logged", "staff", {}, "contacted", null],
  ["consultancy", "contacted", "contact_logged", "staff", {}, "contacted", null],
  ["consultancy", "consultation_booked", "contact_logged", "staff", {}, "consultation_booked", null],
  ["consultancy", "contacted", "consultation_booked", "staff", {}, "consultation_booked", null],
  ["consultancy", "consultation_booked", "consultation_held", "staff", {}, "completed", null],
];

describe("allowed transitions (SPEC §2.4, 0158)", () => {
  it.each(ALLOWED)("%s: %s --%s (%s)-->", (service, from, event, actor, ctx, to, clock) => {
    expect(nextStatus(service, from, event, actor, ctx)).toEqual({ to, clock });
  });

  it("pauses only for a re-upload, resumes only at its end, and stops only on a stage or a decline", () => {
    for (const [, , event, , , to, clock] of ALLOWED) {
      if (clock === "pause") expect(event).toBe("reupload_requested");
      if (clock === "resume") expect(["reupload_fulfilled", "reupload_cancelled"]).toContain(event);
      if (clock === "stage") expect([event, to]).toEqual(["stage_changed", "open"]);
      if (clock === "stop") expect(to).toBe("declined");
    }
  });
});

describe("illegal transitions", () => {
  const ILLEGAL: [MortgageService, MortgageStatus, TransitionEvent, ActorKind, TransitionContext?][] = [
    // A decision is final until the file is moved onto a stage again.
    ["pre_approval", "declined", "declined", "staff"],
    ["pre_approval", "declined", "reupload_requested", "staff"],
    ["pre_approval", "open", "declined", "system"],
    // Events from the other service.
    ["pre_approval", "open", "contact_logged", "staff"],
    ["consultancy", "new", "first_document_opened", "system"],
    ["consultancy", "new", "stage_changed", "staff"],
    ["consultancy", "contacted", "declined", "staff"],
    // Consultancy order.
    ["consultancy", "new", "consultation_booked", "staff"],
    ["consultancy", "contacted", "consultation_held", "staff"],
    ["consultancy", "completed", "contact_logged", "staff"],
    // The wrong actor.
    ["pre_approval", "open", "reupload_fulfilled", "staff", { outstandingReuploads: 0 }],
    ["pre_approval", "open", "reupload_requested", "applicant"],
    ["pre_approval", "open", "first_document_opened", "staff"],
    ["pre_approval", "open", "stage_changed", "bank"],
    ["pre_approval", "open", "stage_changed", "applicant"],
  ];

  it.each(ILLEGAL)("%s: %s --%s (%s)--> refused", (service, from, event, actor, ctx) => {
    expect(() => nextStatus(service, from, event, actor, ctx ?? {})).toThrow(IllegalTransitionError);
    expect(canTransition(service, from, event, actor, ctx ?? {})).toBe(false);
  });

  it("answers every status × event × actor with an outcome or IllegalTransitionError, nothing else", () => {
    const ctx: TransitionContext = { outstandingReuploads: 0 };
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
    // One per (service, status, event) row of ALLOWED.
    const distinct = new Set(ALLOWED.map(([s, f, e]) => `${s}:${f}:${e}`));
    expect(allowed).toBe(distinct.size);
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
        "reupload_cancelled",
        "reupload_requested",
        "stage_changed",
      ].sort(),
    );
  });

  it("closes declined and completed by status; a closing stage closes an open file through closed_at", () => {
    expect(isClosed("declined")).toBe(true);
    expect(isClosed("completed")).toBe(true);
    expect(isClosed("open")).toBe(false);
    expect(isClosed("contacted")).toBe(false);
  });
});
