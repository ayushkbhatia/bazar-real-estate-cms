import { describe, it, expect } from "vitest";
import { notPublishedReason } from "./staff-publishing";

describe("notPublishedReason", () => {
  it("is null for an active advisor — the only publishable combination", () => {
    expect(notPublishedReason({ role: "agent", status: "active" })).toBeNull();
  });

  it("names the role when it isn't `agent`", () => {
    // The whole point of the badge: a complete profile can be filled in here
    // for someone the RLS policy will never expose.
    expect(notPublishedReason({ role: "marketing", status: "active" })).toBe(
      "Role is Marketing — only Advisors publish",
    );
    expect(notPublishedReason({ role: "admin", status: "active" })).toContain(
      "Admin",
    );
  });

  it("distinguishes suspended from never-accepted", () => {
    expect(notPublishedReason({ role: "agent", status: "suspended" })).toBe(
      "Suspended in Users & roles",
    );
    expect(notPublishedReason({ role: "agent", status: "invited" })).toBe(
      "Hasn't accepted their invite yet",
    );
  });

  it("reports status before role when both disqualify", () => {
    expect(notPublishedReason({ role: "marketing", status: "suspended" })).toBe(
      "Suspended in Users & roles",
    );
  });

  it("falls back to the raw role name for one it doesn't label", () => {
    expect(notPublishedReason({ role: "curator", status: "active" })).toContain(
      "curator",
    );
  });
});
