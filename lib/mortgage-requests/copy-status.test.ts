import { describe, expect, it } from "vitest";
import en from "@/messages/en/mortgage.json";
import { CONSENT_WORDINGS, CURRENT_CONSENT_VERSION } from "./consent";
import { PENDING_COPY } from "./copy-status";

function keys(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return v && typeof v === "object" ? keys(v as Record<string, unknown>, path) : [path];
  });
}

const all = keys(en);

describe("copy that isn't final", () => {
  it("names only keys the catalogue has", () => {
    const unknown = PENDING_COPY.filter(({ key }) =>
      key.endsWith(".*")
        ? !all.some((k) => k.startsWith(key.slice(0, -1)))
        : !all.includes(key),
    ).map((p) => p.key);
    expect(unknown).toEqual([]);
  });

  it("stores the consent the page shows, word for word", () => {
    expect(CONSENT_WORDINGS[CURRENT_CONSENT_VERSION]).toBe(en.consent.label);
  });
});
