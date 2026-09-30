import { describe, expect, it } from "vitest";
import { sendOutcome } from "./sends";

describe("sendOutcome", () => {
  it("counts a bank reached only when every inbox was", () => {
    expect(sendOutcome(["sent"])).toBe("sent");
    expect(sendOutcome(["sent", "sent"])).toBe("sent");
    expect(sendOutcome(["sent", "failed"])).toBe("partial");
    expect(sendOutcome(["skipped", "sent"])).toBe("partial");
  });

  it("never reads a skipped send as sent", () => {
    expect(sendOutcome(["skipped"])).toBe("skipped");
    expect(sendOutcome(["skipped", "skipped"])).toBe("skipped");
  });

  it("calls it failed when nothing went and something failed, or there was nowhere to send", () => {
    expect(sendOutcome(["failed"])).toBe("failed");
    expect(sendOutcome(["skipped", "failed"])).toBe("failed");
    expect(sendOutcome([])).toBe("failed");
  });
});
