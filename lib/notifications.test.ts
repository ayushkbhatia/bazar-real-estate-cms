import { describe, it, expect } from "vitest";
import { NOTIFICATION_KIND_LABEL } from "./notifications";

describe("NOTIFICATION_KIND_LABEL", () => {
  it("covers every kind with a readable label", () => {
    const kinds = Object.keys(NOTIFICATION_KIND_LABEL);
    expect(kinds.sort()).toEqual([
      "lead_reassigned",
      "mortgage_at_risk",
      "mortgage_breached",
      "mortgage_request",
      "mortgage_reupload",
      "new_enquiry",
      "system",
    ]);
    for (const k of kinds) {
      const label =
        NOTIFICATION_KIND_LABEL[k as keyof typeof NOTIFICATION_KIND_LABEL];
      expect(label.length).toBeGreaterThan(2);
    }
  });
});
