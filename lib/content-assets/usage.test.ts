import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { FORM_DEFS } from "@/lib/forms/registry";
import {
  allForms,
  assignableForms,
  emailSurfaces,
  formEmailRouting,
  formsSending,
  staticSurfaces,
} from "./usage";
import { SYSTEM_ASSETS, SYSTEM_ASSET_KEYS } from "./system";

describe("formEmailRouting", () => {
  it("sends every lead form the acknowledgement, and the mortgage desk its own", () => {
    const contact = FORM_DEFS.find((f) => f.key === "contact_enquiry")!;
    expect(formEmailRouting(contact)).toEqual({
      kind: "lead",
      defaultEmail: "enquiry_auto_reply",
      assignable: true,
    });
    const mortgage = FORM_DEFS.find((f) => f.key === "mortgage_preapproval")!;
    expect(formEmailRouting(mortgage).defaultEmail).toBe("mortgage_enquiry_ack");
  });

  it("refuses to let a signup or a code email be swapped for a reply", () => {
    const newsletter = FORM_DEFS.find((f) => f.key === "insights_newsletter")!;
    const valuation = FORM_DEFS.find((f) => f.key === "valuation_report_gate")!;
    for (const def of [newsletter, valuation]) {
      const routing = formEmailRouting(def);
      expect(routing.assignable, def.key).toBe(false);
      // The refusal has to explain itself — the UI shows this sentence.
      expect(routing.assignable === false && routing.why.length > 20).toBe(true);
    }
  });

  it("names an email that exists for every form on the site", () => {
    for (const def of allForms()) {
      expect(SYSTEM_ASSETS[formEmailRouting(def).defaultEmail], def.key).toBeTruthy();
    }
    expect(allForms().length).toBe(FORM_DEFS.length);
    expect(assignableForms().length).toBe(FORM_DEFS.length - 2);
  });
});

describe("formsSending", () => {
  it("lists every lead form under the acknowledgement", () => {
    const keys = formsSending("enquiry_auto_reply").map((f) => f.key);
    expect(keys).toContain("contact_enquiry");
    expect(keys).toContain("development_brochure");
    // The mortgage form has its own, and the newsletter's is a confirmation.
    expect(keys).not.toContain("mortgage_preapproval");
    expect(keys).not.toContain("insights_newsletter");
  });

  it("drops a form that has been pointed at a reply of its own", () => {
    const before = formsSending("enquiry_auto_reply").map((f) => f.key);
    const after = formsSending("enquiry_auto_reply", {
      contact_enquiry: "asset-1",
    }).map((f) => f.key);
    expect(before).toContain("contact_enquiry");
    expect(after).not.toContain("contact_enquiry");
    expect(after.length).toBe(before.length - 1);
  });

  it("starts the welcome at the newsletter forms, which is where a subscriber signs up", () => {
    expect(formsSending("newsletter_welcome").map((f) => f.key)).toContain(
      "insights_newsletter",
    );
  });
});

describe("emailSurfaces", () => {
  it("answers 'where does this come from?' for every email in the gallery", () => {
    for (const key of SYSTEM_ASSET_KEYS) {
      expect(emailSurfaces(key).length, key).toBeGreaterThan(0);
    }
    expect(emailSurfaces("advisor_reply").length).toBeGreaterThan(0);
  });

  it("links a form line to both the CMS and the page it sits on", () => {
    const surfaces = emailSurfaces("enquiry_auto_reply");
    const contact = surfaces.find((s) => s.label.startsWith("Submit your enquiry"));
    expect(contact?.path).toBe("/contact");
    expect(contact?.adminPath).toBe("/admin/forms/contact_enquiry");
  });

  it("states the triggers that are not forms", () => {
    expect(staticSurfaces("staff_password_reset").map((s) => s.path)).toContain(
      "/forgot-password",
    );
    expect(staticSurfaces("valuation_report")[0]?.adminPath).toBe("/admin/valuations");
  });

  it("points only at routes the app actually has", () => {
    const app = path.resolve(__dirname, "../../app");
    for (const key of [...SYSTEM_ASSET_KEYS, "advisor_reply" as const]) {
      for (const surface of staticSurfaces(key)) {
        for (const route of [surface.path, surface.adminPath]) {
          if (!route) continue;
          const segments = route.replace(/^\//, "");
          const candidates = [
            `${app}/[locale]/(public)/${segments}/page.tsx`,
            `${app}/[locale]/(admin)/${segments}/page.tsx`,
            `${app}/${segments}/page.tsx`,
          ];
          const found = candidates.some((file) => {
            try {
              readFileSync(file);
              return true;
            } catch {
              return false;
            }
          });
          expect(found, `${key} → ${route}`).toBe(true);
        }
      }
    }
  });
});
