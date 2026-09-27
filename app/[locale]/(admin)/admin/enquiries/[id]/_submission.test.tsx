import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { getFormDef } from "@/lib/forms/registry";
import { describeSourcePage, enquiryOrigin } from "@/lib/enquiries/origin";
import { readAnswers } from "@/lib/enquiries/answers";
import { leadFacts } from "@/lib/enquiries/profile";
import type { RelatedEnquiry } from "@/lib/queries/enquiries";
import { SubmissionCard } from "./_submission";
import { RelatedEnquiries } from "./_history";
import { FollowThrough } from "./_follow-through";

afterEach(cleanup);

/** A brochure request from the Arabic project page — the whole pipeline, no mocks. */
function brochureLead() {
  const def = getFormDef("development_brochure")!;
  const origin = enquiryOrigin("development_brochure", "brochure");
  const page = describeSourcePage("/ar/developments/saadiyat-lagoons", {
    development: { slug: "saadiyat-lagoons", name: "Saadiyat Lagoons" },
  });
  const answers = readAnswers({
    data: { name: "Layla", email: "l@example.com", phone: "+971 50 000 0000" },
    labels: {},
    def,
    fields: def.fields,
  });
  const facts = leadFacts({
    source: "brochure",
    formKey: "development_brochure",
    def,
    inferred: null,
    budgetMin: null,
    budgetMax: null,
    timeline: null,
    preApproved: false,
    locale: "ar",
    propertyMode: null,
  });
  return { origin, page, answers, facts };
}

describe("SubmissionCard", () => {
  it("names the form, the project page it sat on, and the Arabic site", () => {
    const { origin, page, answers, facts } = brochureLead();
    render(
      <SubmissionCard
        origin={origin}
        page={page}
        facts={facts}
        answers={answers}
        canEditForms
      />,
    );

    expect(screen.getByText("Download the brochure")).toBeTruthy();
    // Once as the form's surface, once as the kind of page it was sent from.
    expect(screen.getByText("· Project page")).toBeTruthy();
    expect(screen.getAllByText(/Project page/)).toHaveLength(2);
    expect(screen.getByText("Saadiyat Lagoons")).toBeTruthy();
    expect(screen.getByText("Arabic site")).toBeTruthy();

    const view = screen.getByRole("link", { name: /View page/ });
    expect(view.getAttribute("href")).toBe("/ar/developments/saadiyat-lagoons");
    expect(
      screen.getByRole("link", { name: /Edit project page/ }).getAttribute("href"),
    ).toBe("/admin/pages/sub/development/saadiyat-lagoons");
    expect(
      screen.getByRole("link", { name: /Form & responses/ }).getAttribute("href"),
    ).toBe("/admin/forms/development_brochure");
  });

  it("says a contact-only form asked nothing else, rather than showing an empty grid", () => {
    const { origin, page, answers, facts } = brochureLead();
    render(
      <SubmissionCard
        origin={origin}
        page={page}
        facts={facts}
        answers={answers}
        canEditForms={false}
      />,
    );
    expect(screen.getByText(/the form asked nothing else/)).toBeTruthy();
    // Agents can't open the Forms Manager, so they aren't offered it.
    expect(screen.queryByRole("link", { name: /Form & responses/ })).toBeNull();
    const glance = screen.getByRole("list", { name: "At a glance" });
    expect(within(glance).getByText("Buying")).toBeTruthy();
    expect(within(glance).getByText("Arabic")).toBeTruthy();
  });

  it("shows answers, rewording, skips, consent and the calculator scenario", () => {
    const def = getFormDef("mortgage_preapproval")!;
    const answers = readAnswers({
      data: {
        stage: "offer_in_hand",
        timeline: null,
        message: "Self-employed, two years of accounts.",
        _scenario: "Price AED 3,000,000 · 20% down · 25 years",
      },
      labels: { stage: "How far along are you?" },
      def,
      fields: def.fields,
    });
    render(
      <SubmissionCard
        origin={enquiryOrigin("mortgage_preapproval", "mortgage")}
        page={describeSourcePage("/tools/mortgage")}
        facts={[]}
        answers={{ ...answers, consented: true }}
        canEditForms
      />,
    );

    expect(screen.getByText("Where are you up to?")).toBeTruthy();
    expect(screen.getByText("Offer in hand")).toBeTruthy();
    // The wording is isolated in a <bdi>, so match on the whole line.
    const askedAs = screen.getByText("How far along are you?");
    expect(askedAs.tagName).toBe("BDI");
    expect(askedAs.parentElement?.textContent).toBe(
      "Asked as “How far along are you?”",
    );
    expect(screen.getByText("Self-employed, two years of accounts.")).toBeTruthy();
    expect(screen.getByText(/Buying timeline/)).toBeTruthy();
    expect(screen.getByText(/Left blank:/)).toBeTruthy();
    expect(screen.getByText("Agreed to be contacted")).toBeTruthy();
    expect(
      screen.getByText("Price AED 3,000,000 · 20% down · 25 years"),
    ).toBeTruthy();
  });

  it("is honest when the answers weren't logged or the page wasn't recorded", () => {
    render(
      <SubmissionCard
        origin={enquiryOrigin("buy_hero_enquiry", "contact_page")}
        page={null}
        facts={[]}
        answers={null}
        canEditForms
      />,
    );
    expect(screen.getByText(/Not recorded for this enquiry/)).toBeTruthy();
    expect(screen.getByText("/buy")).toBeTruthy();
    expect(screen.getByText(/answers weren't logged/)).toBeTruthy();
  });

  it("doesn't pretend a WhatsApp lead filled in a form", () => {
    render(
      <SubmissionCard
        origin={enquiryOrigin(null, "whatsapp_inbound")}
        page={null}
        facts={[]}
        answers={null}
        canEditForms
      />,
    );
    expect(screen.getByText("WhatsApp")).toBeTruthy();
    expect(screen.getByText("Not through a website form.")).toBeTruthy();
    expect(screen.getByText(/Nothing was filled in/)).toBeTruthy();
  });
});

describe("RelatedEnquiries", () => {
  const base: RelatedEnquiry = {
    id: "e-2",
    name: "Amira Haddad",
    created_at: "2026-09-01T10:00:00Z",
    status: "closed_won",
    archived_at: null,
    origin: { surface: "Property page", form: "Enquire about this property" },
    property: { reference: "BAZ-AD-04891", title: "Sea view" },
    development: null,
    matchedOn: ["email", "phone"],
  };

  it("lists each earlier enquiry by what it was about, with its stage", () => {
    render(<RelatedEnquiries rows={[base]} currentName="Amira Haddad" />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/admin/enquiries/e-2");
    expect(within(link).getByText("BAZ-AD-04891")).toBeTruthy();
    expect(within(link).getByText("Won")).toBeTruthy();
    expect(within(link).queryByText(/same phone/)).toBeNull();
  });

  it("flags a match on phone alone and a different name", () => {
    render(
      <RelatedEnquiries
        rows={[{ ...base, name: "Omar Haddad", matchedOn: ["phone"] }]}
        currentName="Amira Haddad"
      />,
    );
    expect(screen.getByText(/same phone/)).toBeTruthy();
    expect(screen.getByText(/as “Omar Haddad”/)).toBeTruthy();
  });

  it("renders nothing when there is no history", () => {
    const { container } = render(
      <RelatedEnquiries rows={[]} currentName="Amira" />,
    );
    expect(container.innerHTML).toBe("");
  });
});

describe("FollowThrough", () => {
  it("links a synced lead to its Salesforce record", () => {
    render(
      <FollowThrough
        crm={{
          state: "synced",
          syncedAt: "2026-09-27T10:35:00Z",
          error: null,
          url: "https://example.my.salesforce.com/a04XX",
        }}
        ackSentAt={null}
      />,
    );
    expect(
      screen.getByRole("link", { name: /Open record/ }).getAttribute("href"),
    ).toBe("https://example.my.salesforce.com/a04XX");
    // An unstamped acknowledgement is not reported as unsent.
    expect(screen.queryByText(/Auto-reply/)).toBeNull();
  });

  it("shows why a lead didn't reach Salesforce", () => {
    render(
      <FollowThrough
        crm={{
          state: "failed",
          syncedAt: null,
          error: "REQUIRED_FIELD_MISSING: Phone__c",
          url: null,
        }}
        ackSentAt="2026-09-27T10:33:00Z"
      />,
    );
    expect(screen.getByText(/Didn.t reach Salesforce/)).toBeTruthy();
    expect(screen.getByText("REQUIRED_FIELD_MISSING: Phone__c")).toBeTruthy();
    expect(screen.getByText(/Emailed/)).toBeTruthy();
  });

  it("renders nothing when there is nothing to say", () => {
    const { container } = render(<FollowThrough crm={null} ackSentAt={null} />);
    expect(container.innerHTML).toBe("");
  });
});
