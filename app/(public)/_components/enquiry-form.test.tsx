// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { EnquiryForm } from "./enquiry-form";

// The form posts through a server action; nothing here submits, so a stub is
// enough to keep the module graph loadable in jsdom.
vi.mock("../_actions", () => ({
  createEnquiry: vi.fn(async () => ({ status: "ok" as const })),
}));

/**
 * Two client-visible decisions, both easy to undo by accident:
 *  - the primary CTA reads "Submit"
 *  - the intent picker offers Buy / Sell / Rent only
 *
 * Invest and Manage were removed from the form deliberately. They remain in
 * ENQUIRY_INTENTS and INTENT_LABELS on purpose, so a stale tab submitting one
 * still validates and a historical enquiry still renders a label — which is
 * why asserting on the schema alone would not catch a regression here.
 */
describe("EnquiryForm", () => {
  it("labels the primary action Submit", () => {
    render(<EnquiryForm source="contact_page" />);
    expect(
      screen.getByRole("button", { name: /^submit$/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /send brief/i })).toBeNull();
  });

  it("offers only buy, sell and rent as intents", () => {
    render(<EnquiryForm source="contact_page" showIntent />);
    for (const label of ["Buy", "Sell", "Rent"]) {
      expect(
        screen.getByRole("button", { name: new RegExp(`^${label}$`, "i") }),
        `${label} should be offered`,
      ).toBeInTheDocument();
    }
    for (const label of ["Invest", "Manage"]) {
      expect(
        screen.queryByRole("button", { name: new RegExp(`^${label}$`, "i") }),
        `${label} should no longer be offered`,
      ).toBeNull();
    }
  });

  it("renders no intent picker at all when showIntent is off", () => {
    render(<EnquiryForm source="contact_page" />);
    for (const label of ["Buy", "Sell", "Rent"]) {
      expect(
        screen.queryByRole("button", { name: new RegExp(`^${label}$`, "i") }),
      ).toBeNull();
    }
  });

  it("keeps the compact variant's own CTA", () => {
    // /contact-qr uses this one; it was not part of the change.
    render(<EnquiryForm source="contact_page" compact />);
    expect(
      screen.getByRole("button", { name: /send enquiry/i }),
    ).toBeInTheDocument();
  });
});
