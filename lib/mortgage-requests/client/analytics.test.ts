import { describe, expect, it } from "vitest";
import { allowedProperties, APPLY_FUNNELS, safeProperties } from "./analytics";

// Anything that could say who a visitor is (docs/mortgage SPEC §8).
const PERSONAL = /name|email|mobile|phone|birth|dob|reference|token|address|^ip$|salary|employer|message/i;

describe("the flow's analytics", () => {
  it("lets no event carry a personal property", () => {
    const events = new Set([...APPLY_FUNNELS.pre_approval, ...APPLY_FUNNELS.consultancy].map((s) => s.event));
    for (const event of [
      ...events,
      "mortgage_details_error",
      "mortgage_doc_file_rejected",
      "mortgage_consent_toggled",
      "mortgage_request_failed",
      "mortgage_apply_exit",
      "mortgage_reupload_viewed",
      "mortgage_reupload_otp_sent",
      "mortgage_reupload_otp_failed",
      "mortgage_reupload_verified",
      "mortgage_reupload_sent",
      "mortgage_invite_submitted",
    ] as const) {
      for (const key of allowedProperties(event)) expect(key, `${event}.${key}`).not.toMatch(PERSONAL);
    }
  });

  it("drops keys it wasn't told about, and values that aren't short codes", () => {
    const sneaky = { step: "details", service: "pre_approval", email: "priya.raman@example.com" } as unknown as Parameters<typeof safeProperties<"mortgage_apply_viewed">>[1];
    expect(safeProperties("mortgage_apply_viewed", sneaky)).toEqual({ step: "details", service: "pre_approval" });
    expect(safeProperties("mortgage_details_error", { field: "priya.raman@example.com", rule: "Priya Raman" })).toEqual({});
    expect(safeProperties("mortgage_reupload_otp_failed", { attempt: 3 })).toEqual({ attempt: 3 });
  });

  it("charts each funnel from the service choice to the submit, every step filterable", () => {
    for (const steps of Object.values(APPLY_FUNNELS)) {
      expect(steps[0]).toEqual({ event: "mortgage_apply_viewed", where: { step: "service" } });
      expect(steps.at(-1)!.event).toBe("mortgage_request_submitted");
      for (const step of steps) {
        for (const key of Object.keys("where" in step ? step.where : {})) expect(allowedProperties(step.event)).toContain(key);
      }
    }
  });
});
