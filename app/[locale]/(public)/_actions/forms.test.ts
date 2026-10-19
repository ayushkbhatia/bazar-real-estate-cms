import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultForm, visibleFields } from "@/lib/forms/resolve";
import { HONEYPOT_FIELD, LEGACY_HONEYPOT_FIELD } from "@/lib/forms/spam";
import type { ResolvedForm } from "@/lib/forms/types";

vi.mock("@/lib/queries/forms", () => ({ getForm: vi.fn() }));
vi.mock("@/lib/enquiries/intake", () => ({ fileEnquiry: vi.fn() }));
vi.mock("@/lib/forms/record", () => ({ captureFormSubmission: vi.fn() }));
vi.mock("@/lib/observability", () => ({ reportError: vi.fn() }));
vi.mock("@/lib/queries/master-pages", () => ({
  getMasterPageContent: vi.fn(async () => ({ section: () => null })),
}));
vi.mock("./newsletter", () => ({ subscribeToNewsletter: vi.fn() }));
vi.mock("../services/_actions", () => ({ submitServiceLead: vi.fn() }));

import { submitForm } from "./forms";
import { getForm } from "@/lib/queries/forms";
import { fileEnquiry } from "@/lib/enquiries/intake";
import { captureFormSubmission } from "@/lib/forms/record";
import { subscribeToNewsletter } from "./newsletter";
import { submitServiceLead } from "../services/_actions";

/** A complete, valid set of answers for whatever the form asks. */
function answers(form: ResolvedForm): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of visibleFields(form)) {
    const first = f.options?.[0];
    if (f.type === "email") out[f.key] = "visitor@example.com";
    else if (f.type === "tel" || f.type === "phone_dial")
      out[f.key] = "+971501234567";
    else if (f.type === "checkbox") out[f.key] = true;
    else if (f.type === "range") out[f.key] = "";
    else if (first) out[f.key] = first.value || first.label;
    else if (f.type === "textarea") out[f.key] = "Looking for a two-bed.";
    else out[f.key] = "Test Visitor";
  }
  return out;
}

function use(key: string): ResolvedForm {
  const form = defaultForm(key)!;
  vi.mocked(getForm).mockResolvedValue(form);
  return form;
}

beforeEach(() => {
  vi.mocked(fileEnquiry).mockReset();
  vi.mocked(fileEnquiry).mockResolvedValue({ status: "ok", id: "enq-1" });
  vi.mocked(captureFormSubmission).mockReset();
  vi.mocked(subscribeToNewsletter).mockReset();
  vi.mocked(submitServiceLead).mockReset();
  vi.spyOn(console, "info").mockImplementation(() => {});
});

describe("submitForm and the spam check", () => {
  it("files an ordinary lead live", async () => {
    const form = use("buy_lead_band");
    const result = await submitForm("buy_lead_band", answers(form));

    expect(result).toEqual({ status: "ok", enquiryId: "enq-1" });
    expect(vi.mocked(fileEnquiry).mock.calls[0]![1]).toEqual({ held: null });
    expect(vi.mocked(captureFormSubmission).mock.calls[0]![0].held).toBe(false);
  });

  it("files a lead that filled the trap as held — never drops it", async () => {
    const form = use("buy_lead_band");
    const result = await submitForm("buy_lead_band", {
      ...answers(form),
      [HONEYPOT_FIELD]: "Acme LLC",
    });

    expect(result.status).toBe("ok");
    expect(fileEnquiry).toHaveBeenCalledTimes(1);
    const [lead, opts] = vi.mocked(fileEnquiry).mock.calls[0]!;
    expect(lead.email).toBe("visitor@example.com");
    expect(opts?.held?.reason).toBe("honeypot");
    expect(opts?.held?.note).toMatch(/restore/);
    expect(vi.mocked(captureFormSubmission).mock.calls[0]![0].held).toBe(true);
  });

  it("holds a page served before the honeypot was renamed the same way", async () => {
    const form = use("home_list_property");
    await submitForm("home_list_property", {
      ...answers(form),
      [LEGACY_HONEYPOT_FIELD]: "Acme LLC",
    });
    expect(vi.mocked(fileEnquiry).mock.calls[0]![1]?.held?.reason).toBe(
      "honeypot",
    );
  });

  it("holds a service-landing lead through the intake too", async () => {
    const form = use("services_consultation_lead");
    await submitForm("services_consultation_lead", {
      ...answers(form),
      [HONEYPOT_FIELD]: "x",
    });
    expect(submitServiceLead).not.toHaveBeenCalled();
    expect(vi.mocked(fileEnquiry).mock.calls[0]![1]?.held?.reason).toBe(
      "honeypot",
    );
  });

  it("still shows a held visitor their mistakes", async () => {
    use("buy_lead_band");
    const result = await submitForm("buy_lead_band", { [HONEYPOT_FIELD]: "x" });
    expect(result.status).toBe("error");
    expect(fileEnquiry).not.toHaveBeenCalled();
  });

  it("drops a held newsletter signup without subscribing it", async () => {
    const form = use("insights_newsletter");
    const result = await submitForm("insights_newsletter", {
      ...answers(form),
      [HONEYPOT_FIELD]: "x",
    });
    expect(result).toEqual({ status: "ok", enquiryId: null });
    expect(subscribeToNewsletter).not.toHaveBeenCalled();
    expect(fileEnquiry).not.toHaveBeenCalled();
  });
});
