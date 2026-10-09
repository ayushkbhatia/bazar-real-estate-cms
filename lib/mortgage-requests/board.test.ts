import { describe, expect, it } from "vitest";
import { BOARD_COLUMNS, boardMove } from "./board";
import { nextStatus, TRANSITIONS, type MortgageStatus } from "./state";

describe("the queue board's drops", () => {
  it("lays each service out in the order a file travels", () => {
    expect(BOARD_COLUMNS.pre_approval).toEqual(["new", "in_review", "awaiting_applicant", "with_banks", "pre_approved", "declined"]);
    expect(BOARD_COLUMNS.consultancy).toEqual(["new", "contacted", "consultation_booked", "completed"]);
  });

  it("maps each forward Fast Pre-Approval move to the action that makes it", () => {
    expect(boardMove("pre_approval", "new", "in_review")).toEqual({ kind: "start_review" });
    expect(boardMove("pre_approval", "in_review", "awaiting_applicant")).toEqual({ kind: "request_reupload" });
    expect(boardMove("pre_approval", "new", "awaiting_applicant")).toEqual({ kind: "request_reupload" });
    expect(boardMove("pre_approval", "awaiting_applicant", "in_review")).toEqual({ kind: "cancel_reupload" });
    expect(boardMove("pre_approval", "in_review", "with_banks")).toEqual({ kind: "send_to_banks" });
    expect(boardMove("pre_approval", "with_banks", "pre_approved")).toEqual({ kind: "decide" });
    for (const from of ["new", "in_review", "awaiting_applicant", "with_banks"] as const) {
      expect(boardMove("pre_approval", from, "declined")).toEqual({ kind: "decline" });
    }
  });

  it("maps each forward consultancy move", () => {
    expect(boardMove("consultancy", "new", "contacted")).toEqual({ kind: "log_contact" });
    expect(boardMove("consultancy", "contacted", "consultation_booked")).toEqual({ kind: "book" });
    expect(boardMove("consultancy", "consultation_booked", "completed")).toEqual({ kind: "held" });
  });

  it("refuses what SPEC §2.4 doesn't allow, and says why", () => {
    expect(boardMove("pre_approval", "declined", "in_review")).toEqual({ kind: "illegal", why: "closed" });
    expect(boardMove("pre_approval", "pre_approved", "with_banks")).toEqual({ kind: "illegal", why: "closed" });
    expect(boardMove("pre_approval", "with_banks", "in_review")).toEqual({ kind: "illegal", why: "backwards" });
    expect(boardMove("pre_approval", "in_review", "new")).toEqual({ kind: "illegal", why: "backwards" });
    expect(boardMove("pre_approval", "new", "with_banks")).toEqual({ kind: "illegal", why: "needsReview" });
    expect(boardMove("pre_approval", "in_review", "pre_approved")).toEqual({ kind: "illegal", why: "needsBanks" });
    expect(boardMove("pre_approval", "awaiting_applicant", "with_banks")).toEqual({ kind: "illegal", why: "reuploadOpen" });
    expect(boardMove("consultancy", "new", "consultation_booked")).toEqual({ kind: "illegal", why: "needsContact" });
    expect(boardMove("consultancy", "contacted", "completed")).toEqual({ kind: "illegal", why: "needsBooking" });
    expect(boardMove("consultancy", "completed", "contacted")).toEqual({ kind: "illegal", why: "closed" });
    expect(boardMove("consultancy", "consultation_booked", "contacted")).toEqual({ kind: "illegal", why: "backwards" });
    expect(boardMove("pre_approval", "in_review", "in_review")).toEqual({ kind: "same" });
  });

  it("only offers moves the transition table can make (state.ts mirrors mortgage_transition)", () => {
    // Every drop that isn't refused must land where some event from `from` leads.
    const reach = (service: "pre_approval" | "consultancy", from: MortgageStatus): Set<MortgageStatus> => {
      const out = new Set<MortgageStatus>();
      for (const rule of TRANSITIONS.filter((r) => r.service === service && r.from.includes(from))) {
        try {
          out.add(
            nextStatus(service, from, rule.event, rule.actor, {
              outstandingReuploads: 0,
              acceptedDocuments: 4,
              requiredDocuments: 4,
              consentOnFile: true,
              bankSubmissions: 1,
            }).to,
          );
        } catch {
          // A guarded move that these facts don't open.
        }
      }
      return out;
    };
    for (const service of ["pre_approval", "consultancy"] as const) {
      for (const from of BOARD_COLUMNS[service]) {
        for (const to of BOARD_COLUMNS[service]) {
          const move = boardMove(service, from, to);
          if (move.kind === "same" || move.kind === "illegal") continue;
          // A re-upload from New first moves the file to In review, as the action does.
          const start = from === "new" && move.kind === "request_reupload" ? "in_review" : from;
          expect(reach(service, start as MortgageStatus).has(to as MortgageStatus), `${service}: ${from} → ${to}`).toBe(true);
        }
      }
    }
  });
});
