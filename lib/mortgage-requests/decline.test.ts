import { describe, expect, it } from "vitest";
import { describeEvent, type EventInput } from "./activity";
import { DECLINABLE, DECLINE_REASONS, declineMessage, declineReasonLabel, declineReasonsFor, isDeclineReason } from "./decline";
import { canTransition, PRE_APPROVAL_STATUSES } from "./state";

const names = { applicantFirstName: "Priya", adviserFirstName: "Yasmin" };

describe("decline reasons (D19)", () => {
  it("each has a label of its own", () => {
    const labels = DECLINE_REASONS.map(declineReasonLabel);
    expect(new Set(labels).size).toBe(DECLINE_REASONS.length);
    for (const label of labels) expect(label).not.toMatch(/^decline\./);
    expect(declineReasonLabel("debt_burden")).toBe("Monthly debts too high (DBR)");
  });

  it("offers 'no bank made an offer' only once the banks were asked", () => {
    expect(declineReasonsFor("with_banks")).toContain("no_bank_offer");
    for (const status of ["new", "in_review", "awaiting_applicant"] as const) {
      expect(declineReasonsFor(status)).not.toContain("no_bank_offer");
      expect(declineReasonsFor(status)).toHaveLength(DECLINE_REASONS.length - 1);
    }
  });

  it("is declinable exactly where the state machine allows it", () => {
    for (const status of PRE_APPROVAL_STATUSES) {
      expect(DECLINABLE.includes(status), status).toBe(canTransition("pre_approval", status, "declined", "staff"));
    }
  });

  it("knows its own values", () => {
    expect(isDeclineReason("credit_report")).toBe(true);
    expect(isDeclineReason("bad_luck")).toBe(false);
    expect(isDeclineReason(null)).toBe(false);
  });
});

describe("the message the adviser starts from", () => {
  it("thanks, gives the outcome, the reason, what could change it, an open door and the adviser's name", () => {
    const text = declineMessage("debt_burden", names);
    const paragraphs = text.split("\n\n");
    expect(paragraphs).toHaveLength(5);
    expect(paragraphs[0]).toBe(
      "Priya, thank you for applying for Fast Pre-Approval with Bazar. I've been through your application carefully, and I'm sorry to say we're not able to secure a pre-approval for you at the moment.",
    );
    expect(paragraphs[1]).toMatch(/Central Bank .* half of your monthly income/);
    expect(paragraphs[2]).toMatch(/^Paying down or closing/);
    expect(paragraphs[3]).toBe("If you'd like to talk it through, just reply to this email.");
    expect(paragraphs[4]).toBe("Yasmin");
  });

  it("has words of its own for every reason but 'Other', which the adviser writes", () => {
    const bodies = new Set<string>();
    for (const reason of DECLINE_REASONS) {
      const paragraphs = declineMessage(reason, names).split("\n\n");
      if (reason === "other") {
        expect(paragraphs).toHaveLength(3);
        continue;
      }
      expect(paragraphs, reason).toHaveLength(5);
      for (const p of paragraphs) expect(p, reason).not.toMatch(/decline\.template/);
      bodies.add(paragraphs[1]!);
    }
    expect(bodies.size).toBe(DECLINE_REASONS.length - 1);
  });

  it("leaves the signature off when there's no name to sign with", () => {
    expect(declineMessage("credit_report", { applicantFirstName: "Karim", adviserFirstName: "" }).endsWith("reply to this email.")).toBe(true);
  });

  it("says the banks were asked only in the reason that needs them", () => {
    for (const reason of DECLINE_REASONS) {
      const says = /shared your application with our partner banks/.test(declineMessage(reason, names));
      expect(says, reason).toBe(reason === "no_bank_offer");
    }
  });
});

describe("the decline in the activity log", () => {
  const ctx = { service: "pre_approval" as const, applicantName: "Priya Raman", mobile: "+971502184417", names: new Map([["y", "Yasmin Abdalla"]]), now: new Date("2026-09-29T10:00:00Z") };
  const event = (type: string, data: Record<string, unknown>): EventInput => ({
    id: type,
    type,
    actor_kind: "staff",
    actor_id: "y",
    data,
    created_at: "2026-09-29T09:30:00Z",
  });

  it("says who declined and why, once", () => {
    const line = describeEvent(event("decision.declined", { reason: "credit_report", channels: ["email"] }), ctx);
    expect([line?.text, line?.sub]).toEqual(["Yasmin declined the application", "Credit report (AECB)"]);
    expect(describeEvent(event("status.changed", { from: "in_review", to: "declined", event: "declined" }), ctx)).toBeNull();
  });
});
