import { describe, it, expect } from "vitest";
import { unpublishWarning } from "./staff-publishing";

const base = {
  displayName: "Bazar Real Estate",
  currentRole: "agent",
  currentStatus: "active",
  counts: { properties: 69, developments: 27 },
};

describe("unpublishWarning", () => {
  it("warns when an active agent is suspended", () => {
    const w = unpublishWarning({ ...base, nextStatus: "suspended" });
    expect(w).toContain("Bazar Real Estate will come off the public site.");
    expect(w).toContain("69 published listings");
    expect(w).toContain("27 published projects");
  });

  it("warns when an active agent's role moves off `agent`", () => {
    // The gate is the RLS policy's, not the UI's: `marketing` is staff, but
    // `staff_public_agents` hands nothing to anon for them.
    expect(unpublishWarning({ ...base, nextRole: "marketing" })).toContain(
      "come off the public site",
    );
  });

  it("says so plainly when nothing is assigned", () => {
    const w = unpublishWarning({
      ...base,
      counts: { properties: 0, developments: 0 },
      nextStatus: "suspended",
    });
    expect(w).toContain("No listings or projects are assigned to them.");
    expect(w).not.toContain("published listing");
  });

  it("singularises one of each", () => {
    const w = unpublishWarning({
      ...base,
      counts: { properties: 1, developments: 1 },
      nextStatus: "suspended",
    });
    expect(w).toContain("1 published listing will");
    expect(w).toContain("1 published project will");
  });

  it("is silent when the change publishes rather than unpublishes", () => {
    expect(
      unpublishWarning({
        ...base,
        currentStatus: "suspended",
        nextStatus: "active",
      }),
    ).toBeNull();
  });

  it("is silent for someone who was never publishable", () => {
    // Suspending a marketing user takes nothing off the site, so the dialog
    // would be noise — and noise is how a real warning gets clicked through.
    expect(
      unpublishWarning({
        ...base,
        currentRole: "marketing",
        nextStatus: "suspended",
      }),
    ).toBeNull();
  });

  it("is silent when neither role nor status actually changes", () => {
    expect(unpublishWarning({ ...base })).toBeNull();
  });

  it("still warns when the count could not be taken, without claiming zero", () => {
    const w = unpublishWarning({
      ...base,
      counts: undefined,
      nextStatus: "suspended",
    });
    expect(w).toContain("come off the public site");
    expect(w).toContain("Couldn't check");
    expect(w).not.toContain("No listings or projects are assigned");
  });
});
