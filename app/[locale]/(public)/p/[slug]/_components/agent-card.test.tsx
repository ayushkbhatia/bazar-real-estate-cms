import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AgentCard } from "./agent-card";
import type { PropertyAdvisor } from "@/lib/queries/property-advisor";
import { defaultForm } from "@/lib/forms";

// The card renders a dialog trigger; the dialog itself pulls in the enquiry
// server action, which isn't what these assertions are about.
vi.mock("./enquiry-dialog", () => ({
  PropertyEnquiryDialog: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

const BASE: PropertyAdvisor = {
  user_id: "user-1",
  slug: "sample-advisor",
  display_name: "Sample Advisor",
  title: "Senior Advisor",
  brn: "BRN-00001",
  photo_url: null,
  languages: ["English", "Arabic"],
  email: null,
  phone: null,
  whatsapp: null,
};

function renderCard(advisor: Partial<PropertyAdvisor>) {
  return render(
    <AgentCard
      enquiryForm={defaultForm("property_enquiry")!}
      advisor={{ ...BASE, ...advisor }}
      propertyId="prop-1"
      propertyReference="BAZ-AD-00001"
      propertyTitle="Sample Listing"
    />,
  );
}

describe("AgentCard contact actions", () => {
  it("renders the advisor's identity from the assigned staff row", () => {
    renderCard({});
    expect(screen.getByText("Sample Advisor")).toBeDefined();
    expect(screen.getByText("Senior Advisor")).toBeDefined();
    expect(screen.getByText("BRN-00001")).toBeDefined();
    // Profile links point at the real staff slug, not a seed one.
    const link = screen.getAllByRole("link")[0] as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/agents/sample-advisor");
  });

  it("hides every direct action while the contact fields are empty", () => {
    renderCard({});
    expect(screen.queryByText("Call")).toBeNull();
    expect(screen.queryByText("WhatsApp")).toBeNull();
    expect(screen.queryByText("Email")).toBeNull();
    // The enquiry route is always available, so the card is never a dead end.
    expect(screen.getByText(/Enquire about BAZ-AD-00001/)).toBeDefined();
  });

  it("renders tel: / wa.me / mailto once the fields are filled", () => {
    renderCard({
      phone: "+971 2 555 0001",
      whatsapp: "+971 50 123 4567",
      email: "advisor@bazar.ae",
    });
    const hrefs = screen
      .getAllByRole("link")
      .map((a) => (a as HTMLAnchorElement).getAttribute("href"));

    expect(hrefs).toContain("tel:+97125550001");
    expect(
      hrefs.some((h) => h?.startsWith("https://wa.me/971501234567?text=")),
    ).toBe(true);
    expect(
      hrefs.some((h) => h?.startsWith("mailto:advisor@bazar.ae?subject=")),
    ).toBe(true);
  });

  it("falls back to the phone number when WhatsApp is blank", () => {
    renderCard({ phone: "+971 2 555 0001", whatsapp: "+971 2 555 0001" });
    const hrefs = screen
      .getAllByRole("link")
      .map((a) => (a as HTMLAnchorElement).getAttribute("href"));
    expect(hrefs.some((h) => h?.startsWith("https://wa.me/97125550001"))).toBe(
      true,
    );
    expect(hrefs.some((h) => h?.startsWith("mailto:"))).toBe(false);
  });
});
