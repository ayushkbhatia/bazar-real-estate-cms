import { describe, expect, it } from "vitest";
import en from "@/messages/en/mortgage.json";
import ar from "@/messages/ar/mortgage.json";
import { defaultDocument, resolveSections } from "./index";
import type { SectionValues } from "./types";
import {
  MORTGAGE_EDITABLE_KEYS,
  MORTGAGE_FLOW_DEFAULTS,
  isCountedMessage,
  wizardCopyIssues,
  wizardPageDef,
  wizardSections,
  wizardSlug,
  wizardStoredValues,
} from "./wizards";
import { overlayMessages, wizardOverlay } from "@/lib/queries/wizards";

type Tree = { [k: string]: string | Tree };
const flat = (tree: Tree, p = ""): [string, string][] =>
  Object.entries(tree).flatMap(([k, v]) => (typeof v === "string" ? [[p ? `${p}.${k}` : k, v] as [string, string]] : flat(v, p ? `${p}.${k}` : k)));
const EN = new Map(flat(en as Tree));
const AR = new Map(flat(ar as Tree));

const def = wizardPageDef("mortgage-application");
const section = (key: string) => def.sections.find((s) => s.key === key)!;
const docWith = (sectionKey: string, values: SectionValues) =>
  defaultDocument(def).map((s) => (s.key === sectionKey ? { ...s, values: { ...s.values, ...values } } : s));

describe("Wizards → Mortgage application", () => {
  it("offers every message in the catalogue except the counted phrases, each once", () => {
    const fields = wizardSections().flatMap((s) => s.fields.map((f) => f.key));
    expect(new Set(fields).size).toBe(fields.length);
    for (const [key, message] of EN) {
      if (isCountedMessage(message)) expect(fields, key).not.toContain(key);
      else expect(fields, key).toContain(key);
    }
    expect(MORTGAGE_EDITABLE_KEYS.length).toBe(fields.filter((k) => k.includes(".")).length);
  });

  it("starts from the catalogue: English as the default, the catalogue's Arabic as the twin", () => {
    for (const s of wizardSections().filter((s) => s.key !== "flow")) {
      for (const field of s.fields) {
        expect(s.defaults[field.key], field.key).toBe(EN.get(field.key));
        if ("i18n" in field && field.i18n === false) expect(s.defaults[`${field.key}_ar`]).toBeUndefined();
        else expect(s.defaults[`${field.key}_ar`], field.key).toBe(AR.get(field.key));
      }
    }
  });

  it("puts the flow's switches first and the screens in the order an applicant meets them", () => {
    expect(def.sections.map((s) => s.key)).toEqual(["flow", "shell", "w1", "w2", "w3", "documents", "submit", "w7", "w8"]);
    expect(section("flow").defaults).toEqual(MORTGAGE_FLOW_DEFAULTS);
    expect(wizardSlug("mortgage-application")).toBe("subpage/wizard/mortgage-application");
  });

  it("marks the wording that still awaits sign-off", () => {
    const field = section("w1").fields.find((f) => f.key === "w1.preApproval.badge")!;
    expect(field.label).toContain("awaiting sign-off: D11a");
  });

  it("lets an edit through that keeps the placeholders and marks", () => {
    const doc = docWith("w8", { "w8.invite.reference": "Your reference: {reference}." });
    expect(wizardCopyIssues("mortgage-application", doc)).toEqual([]);
  });

  it("refuses a dropped or invented placeholder, changed marks and a stray brace, in either language", () => {
    expect(EN.get("w8.invite.reference")).toContain("{reference}");
    const dropped = wizardCopyIssues("mortgage-application", docWith("w8", { "w8.invite.reference": "Your application is in." }));
    expect(dropped[0]!.message).toContain("Keep {reference}");
    const invented = wizardCopyIssues("mortgage-application", docWith("w8", { "w8.invite.reference": "{reference} for {name}" }));
    expect(invented[0]!.message).toContain("{name}");
    const bold = [...EN].find(([k, v]) => v.includes("<b>") && !isCountedMessage(v) && !/\{/.test(v))!;
    const sectionKey = def.sections.find((s) => s.fields.some((f) => f.key === bold[0]))!.key;
    const marks = wizardCopyIssues("mortgage-application", docWith(sectionKey, { [bold[0]]: bold[1].replace(/<\/?b>/g, "") }));
    expect(marks[0]!.message).toContain("marks");
    const arabic = wizardCopyIssues("mortgage-application", docWith("w8", { "w8.invite.reference_ar": "مرجعك" }));
    expect(arabic[0]!.field).toContain("(Arabic)");
    const plain = [...EN].find(([k, v]) => !/[{<]/.test(v) && k.startsWith("w1."))!;
    const brace = wizardCopyIssues("mortgage-application", docWith("w1", { [plain[0]]: "Choose {" }));
    expect(brace.length).toBeGreaterThan(0);
  });

  it("stores only what differs from the catalogue, and the switches as set", () => {
    const stored = wizardStoredValues(
      docWith("w1", { "w1.title": "Pick a service", "w1.lede": EN.get("w1.lede")! }).map((s) =>
        s.key === "flow" ? { ...s, values: { ...s.values, w1_first: "pre_approval" } } : s,
      ),
    );
    expect(stored.find((s) => s.key === "w1")!.values).toEqual({ "w1.title": "Pick a service" });
    expect(stored.find((s) => s.key === "w2")!.values).toEqual({});
    expect(stored.find((s) => s.key === "flow")!.values.w1_first).toBe("pre_approval");
  });

  it("lays only the edited messages over the catalogue, and reads the switches", () => {
    const stored = wizardStoredValues(
      docWith("w1", { "w1.title": "Pick a service" }).map((s) => (s.key === "flow" ? { ...s, values: { ...s.values, show_w1_rail: false } } : s)),
    );
    const overlay = wizardOverlay(resolveSections(def, stored, "en"), "en");
    expect(overlay.messages).toEqual({ w1: { title: "Pick a service" } });
    expect(overlay.flow).toEqual({ ...MORTGAGE_FLOW_DEFAULTS, show_w1_rail: false });
    const merged = overlayMessages(en as unknown as Tree, overlay.messages) as Tree;
    expect((merged.w1 as Tree).title).toBe("Pick a service");
    expect((merged.w1 as Tree).lede).toBe((en as unknown as Tree & { w1: Tree }).w1.lede);
    // Nothing stored: nothing laid over.
    expect(wizardOverlay(resolveSections(def, null, "en"), "en").messages).toEqual({});
  });
});
