import { describe, expect, it, vi } from "vitest";
import { identifyUser } from "./posthog";

describe("identifyUser", () => {
  it("identifies with userId and email when email is present", () => {
    const identify = vi.fn();
    identifyUser({ identify }, "user-123", "person@example.com");
    expect(identify).toHaveBeenCalledTimes(1);
    expect(identify).toHaveBeenCalledWith("user-123", {
      email: "person@example.com",
    });
  });

  it("identifies with userId only when email is missing", () => {
    const identify = vi.fn();
    identifyUser({ identify }, "user-456", null);
    expect(identify).toHaveBeenCalledTimes(1);
    expect(identify).toHaveBeenCalledWith("user-456", undefined);
  });
});
