import { describe, expect, it } from "vitest";
import { bindLastWords } from "./service-hero";

describe("bindLastWords", () => {
  it("keeps a two-word place name at the end of the headline together", () => {
    expect(bindLastWords("Property Management in Abu Dhabi")).toBe("Property Management in Abu Dhabi");
    expect(bindLastWords("إدارة العقارات في أبوظبي")).toBe("إدارة العقارات في أبوظبي");
  });

  it("leaves a title of one or two words to wrap where it must", () => {
    expect(bindLastWords("Property Consultation")).toBe("Property Consultation");
    expect(bindLastWords("")).toBe("");
  });
});
