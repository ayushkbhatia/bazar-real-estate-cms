import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const updateComplianceMock = vi.fn();
const publishPropertyMock = vi.fn();

vi.mock("./_actions", () => ({
  updateCompliance: (...args: unknown[]) => updateComplianceMock(...args),
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

// Everything passes EXCEPT compliance — the classic "ticked the boxes but the
// button won't enable" scenario the reactivity fix targets.
const READY_INPUT: PublishInput = {
  status: "draft",
  has_hero: true,
  has_developer: true,
  poa_optional: true,
  listing_permit_no: "ORN-12345-AD",
  listing_permit_expires_at: "2099-12-31",
  slug: "mamsha-3-bed-beachfront",
  title: "Mamsha · 3-bed beachfront",
  price_aed: 4_200_000,
};

const ALL_FALSE = {
  form_a: false,
  title_deed: false,
  noc: false,
  power_of_attorney: false,
};

describe("<PublishCard> reactivity", () => {
  beforeEach(() => {
    updateComplianceMock.mockReset().mockResolvedValue({ status: "ok" });
    publishPropertyMock.mockReset().mockResolvedValue({
      status: "ok",
      message: "Published.",
    });
  });

  it("enables Publish once the required compliance boxes are ticked — no reload", async () => {
    const user = userEvent.setup();
    render(
      <PublishCard
        propertyId="abc"
        status="draft"
        compliance={ALL_FALSE}
        input={READY_INPUT}
      />,
    );

    const publishBtn = screen.getByRole("button", { name: /publish/i });
    // Starts disabled: the 3 required compliance checks fail.
    expect(publishBtn).toBeDisabled();

    await user.click(screen.getByLabelText(/Form A signed/i));
    await user.click(screen.getByLabelText(/Title deed verified/i));
    await user.click(screen.getByLabelText(/NOC obtained/i));

    // Recomputed live from local compliance state — enabled without any
    // navigation / router refresh.
    await waitFor(() => expect(publishBtn).toBeEnabled());
    expect(updateComplianceMock).toHaveBeenCalledTimes(3);
  });

  it("keeps Publish disabled while a required input (hero) is missing", () => {
    render(
      <PublishCard
        propertyId="abc"
        status="draft"
        compliance={{ ...ALL_FALSE, form_a: true, title_deed: true, noc: true }}
        input={{ ...READY_INPUT, has_hero: false }}
      />,
    );
    expect(screen.getByRole("button", { name: /publish/i })).toBeDisabled();
    expect(
      screen.getByText(/At least one hero image/i),
    ).toBeInTheDocument();
  });

  it("does not require Power of Attorney (optional)", () => {
    render(
      <PublishCard
        propertyId="abc"
        status="draft"
        compliance={{ ...ALL_FALSE, form_a: true, title_deed: true, noc: true }}
        input={READY_INPUT}
      />,
    );
    // PoA left unticked, everything else satisfied → publishable.
    expect(screen.getByRole("button", { name: /publish/i })).toBeEnabled();
  });
});
