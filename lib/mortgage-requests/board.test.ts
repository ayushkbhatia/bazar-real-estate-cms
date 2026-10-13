import { describe, expect, it } from "vitest";
import { boardMove, columnKeyOf, CONSULTANCY_COLUMNS, movesOnBoard } from "./board";
import { DECLINED_KEY } from "./stages";
import { nextStatus, TRANSITIONS, type MortgageStatus } from "./state";

const NEW = "11111111-1111-4111-8111-111111111111";
const VALUATION = "55555555-5555-4555-8555-555555555555";
const DISBURSED = "88888888-8888-4888-8888-888888888888";

describe("the queue board's drops", () => {
  it("lays the consultancy lane out in the order a request travels", () => {
    expect(CONSULTANCY_COLUMNS).toEqual(["new", "contacted", "consultation_booked", "completed"]);
  });

  it("puts a Fast Pre-Approval in its stage's column, or Declined", () => {
    expect(columnKeyOf({ service: "pre_approval", status: "open", stage: { id: VALUATION } })).toBe(VALUATION);
    expect(columnKeyOf({ service: "pre_approval", status: "declined", stage: { id: VALUATION } })).toBe(DECLINED_KEY);
    expect(columnKeyOf({ service: "consultancy", status: "contacted", stage: null })).toBe("contacted");
  });

  it("moves a Fast Pre-Approval freely: any stage to any stage, back, forward, out of a closing stage or Declined", () => {
    expect(boardMove("pre_approval", NEW, VALUATION)).toEqual({ kind: "move_stage", stageId: VALUATION });
    expect(boardMove("pre_approval", VALUATION, NEW)).toEqual({ kind: "move_stage", stageId: NEW });
    expect(boardMove("pre_approval", DISBURSED, VALUATION)).toEqual({ kind: "move_stage", stageId: VALUATION });
    expect(boardMove("pre_approval", DECLINED_KEY, NEW)).toEqual({ kind: "move_stage", stageId: NEW });
    for (const from of [NEW, VALUATION, DISBURSED]) {
      expect(boardMove("pre_approval", from, DECLINED_KEY)).toEqual({ kind: "decline" });
    }
    expect(boardMove("pre_approval", VALUATION, VALUATION)).toEqual({ kind: "same" });
    expect(boardMove("pre_approval", DECLINED_KEY, DECLINED_KEY)).toEqual({ kind: "same" });
  });

  it("maps each forward consultancy move", () => {
    expect(boardMove("consultancy", "new", "contacted")).toEqual({ kind: "log_contact" });
    expect(boardMove("consultancy", "contacted", "consultation_booked")).toEqual({ kind: "book" });
    expect(boardMove("consultancy", "consultation_booked", "completed")).toEqual({ kind: "held" });
  });

  it("refuses the consultancy moves SPEC §2.4 doesn't allow, and says why", () => {
    expect(boardMove("consultancy", "new", "consultation_booked")).toEqual({ kind: "illegal", why: "needsContact" });
    expect(boardMove("consultancy", "contacted", "completed")).toEqual({ kind: "illegal", why: "needsBooking" });
    expect(boardMove("consultancy", "completed", "contacted")).toEqual({ kind: "illegal", why: "closed" });
    expect(boardMove("consultancy", "consultation_booked", "contacted")).toEqual({ kind: "illegal", why: "backwards" });
  });

  it("finishes stage moves and declines on the board; booking opens the file", () => {
    expect(movesOnBoard({ kind: "move_stage", stageId: NEW })).toBe(true);
    expect(movesOnBoard({ kind: "decline" })).toBe(true);
    expect(movesOnBoard({ kind: "book" })).toBe(false);
  });

  it("only offers consultancy moves the transition table can make (state.ts mirrors mortgage_transition)", () => {
    const reach = (from: MortgageStatus): Set<MortgageStatus> => {
      const out = new Set<MortgageStatus>();
      for (const rule of TRANSITIONS.filter((r) => r.service === "consultancy" && r.from.includes(from))) {
        out.add(nextStatus("consultancy", from, rule.event, rule.actor, {}).to);
      }
      return out;
    };
    for (const from of CONSULTANCY_COLUMNS) {
      for (const to of CONSULTANCY_COLUMNS) {
        const move = boardMove("consultancy", from, to);
        if (move.kind === "same" || move.kind === "illegal") continue;
        expect(reach(from).has(to), `${from} → ${to}`).toBe(true);
      }
    }
    // And the board's stage moves are ones the transition table makes, from open and from declined.
    expect(nextStatus("pre_approval", "open", "stage_changed", "staff").to).toBe("open");
    expect(nextStatus("pre_approval", "declined", "stage_changed", "staff").to).toBe("open");
  });
});
