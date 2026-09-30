import { describe, expect, it } from "vitest";
import { uaeMobileE164 } from "./server/dsr";

describe("the DSR tool's mobile", () => {
  it("takes a UAE mobile however it was written", () => {
    for (const raw of ["+971 50 218 4417", "0502184417", "971502184417", "00971 50-218-4417", "50 218 4417"]) {
      expect(uaeMobileE164(raw)).toBe("+971502184417");
    }
  });

  it("refuses anything else, and treats blank as none", () => {
    for (const raw of ["+44 7700 900123", "02 632 2223", "12345"]) expect(uaeMobileE164(raw)).toBeNull();
    for (const raw of ["", "   ", null, undefined]) expect(uaeMobileE164(raw)).toBeNull();
  });
});
