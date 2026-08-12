import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const publishPropertyMock = vi.fn();

vi.mock("./_actions", () => ({
  publishProperty: (...args: unknown[]) => publishPropertyMock(...args),
  unpublishProperty: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import { PublishCard, type PublishInput } from "./_publish-card";

const READY_INPUT: PublishInput = {
  status: "draft",
  has_developer: true,
  listing_permit_no: "ORN-12345-AD",
  listing_permit_expires_at: "2099-12-31",
  slug: "mamsha-3-bed-beachfront",
  title: "Mamsha · 3-bed beachfront",
  price_aed: 4_200_000,
};

describe("<PublishCard>", () => {
  beforeEach(() => {
    publishPropertyMock.mockReset().mockResolvedValue({
      status: "ok",
      message: "Published.",
    });
  });

  it("enables Publish on a listing that clears the pre-flight", () => {
    render(<PublishCard propertyId="abc" status="draft" input={READY_INPUT} />);
    expect(screen.getByRole("button", { name: /publish/i })).toBeEnabled();
  });

  it("no longer renders compliance paperwork or a hero-image check", () => {
    render(<PublishCard propertyId="abc" status="draft" input={READY_INPUT} />);
    expect(screen.queryByText(/compliance/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/form a/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/title deed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/noc/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/power of attorney/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/hero image/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("blocks and explains when the developer is missing", () => {
    render(
      <PublishCard
        propertyId="abc"
        status="draft"
        input={{ ...READY_INPUT, has_developer: false }}
      />,
    );
    expect(screen.getByRole("button", { name: /publish/i })).toBeDisabled();
    expect(screen.getByText("Developer is set")).toBeInTheDocument();
    expect(screen.getByText(/Pick a developer in the/i)).toBeInTheDocument();
  });

  it("blocks and explains when a sale listing has no form", () => {
    render(
      <PublishCard
        propertyId="abc"
        status="draft"
        input={{ ...READY_INPUT, mode: "buy", property_form: null }}
      />,
    );
    expect(screen.getByRole("button", { name: /publish/i })).toBeDisabled();
    expect(screen.getByText("Sale form is set")).toBeInTheDocument();
    expect(screen.getByText(/Choose Ready \(new\) or Resale/i)).toBeInTheDocument();
  });

  it("does not show a form check on a rental", () => {
    render(
      <PublishCard
        propertyId="abc"
        status="draft"
        input={{ ...READY_INPUT, mode: "rent", property_form: null }}
      />,
    );
    expect(screen.getByRole("button", { name: /publish/i })).toBeEnabled();
    expect(screen.queryByText("Sale form is set")).not.toBeInTheDocument();
  });

  it("blocks and explains when the listing permit is missing or expired", () => {
    const { unmount } = render(
      <PublishCard
        propertyId="abc"
        status="draft"
        input={{ ...READY_INPUT, listing_permit_no: null }}
      />,
    );
    expect(screen.getByRole("button", { name: /publish/i })).toBeDisabled();
    expect(
      screen.getByText(/Set the listing permit number/i),
    ).toBeInTheDocument();
    unmount();

    render(
      <PublishCard
        propertyId="abc"
        status="draft"
        input={{ ...READY_INPUT, listing_permit_expires_at: "2010-01-01" }}
      />,
    );
    expect(screen.getByRole("button", { name: /publish/i })).toBeDisabled();
    expect(screen.getByText("Listing permit not expired")).toBeInTheDocument();
  });
});
