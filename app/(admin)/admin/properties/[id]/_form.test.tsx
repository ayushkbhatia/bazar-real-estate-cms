import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { PropertyEditInput } from "@/lib/schemas/property";

const updatePropertyMock = vi.fn();
const setPropertyDeveloperMock = vi.fn();

vi.mock("./_actions", () => ({
  updateProperty: (...args: unknown[]) => updatePropertyMock(...args),
  setPropertyDeveloper: (...args: unknown[]) =>
    setPropertyDeveloperMock(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: refreshMock,
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
}));

import { PropertyEditForm } from "./_form";
import { toast } from "sonner";

const DEVELOPERS = [
  { id: "11111111-1111-1111-1111-111111111111", name: "Aldar Properties" },
];

const INITIAL: PropertyEditInput = {
  title: "Mamsha · 3-bed beachfront",
  short_description: "Three-bedroom apartment with sea views.",
  type: "apartment",
  mode: "buy",
  price_aed: 4_200_000,
  service_charge_per_ft2: 18.5,
  beds: 3,
  baths: 4,
  built_up_ft2: 2840,
  plot_ft2: null,
  year_built: 2023,
  tenure: "freehold",
  furnishing: "fully",
  view: "Sea view",
  orientation: null,
  parking_bays: 2,
  floor: 7,
  address_line: "Mamsha Al Saadiyat",
  listing_permit_no: null,
  listing_permit_expires_at: null,
  dld_plot_number: null,
  area_id: null,
  developer_id: "11111111-1111-1111-1111-111111111111",
  amenities: ["Pool", "Gym"],
  slug: "mamsha-3-bed-beachfront-apartment",
  meta_title: null,
  meta_description: null,
};

describe("<PropertyEditForm>", () => {
  beforeEach(() => {
    updatePropertyMock.mockReset();
    setPropertyDeveloperMock.mockReset().mockResolvedValue({ status: "ok" });
    refreshMock.mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("renders the Overview tab with seeded defaults", () => {
    render(
      <PropertyEditForm
        propertyId="abc"
        initial={INITIAL}
        reference="BAZ-AD-04891"
        areas={[]}
        developers={DEVELOPERS}
        geo={null}
        mapboxAvailable={false}
      />,
    );
    expect(screen.getByLabelText(/title/i)).toHaveValue(INITIAL.title);
    expect(screen.getByLabelText(/short description/i)).toHaveValue(
      INITIAL.short_description ?? "",
    );
    expect(screen.getByText("BAZ-AD-04891")).toBeInTheDocument();
  });

  it("disables Save until the form is dirty", () => {
    render(
      <PropertyEditForm
        propertyId="abc"
        initial={INITIAL}
        reference="BAZ-AD-04891"
        areas={[]}
        developers={DEVELOPERS}
        geo={null}
        mapboxAvailable={false}
      />,
    );
    expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
  });

  it("submits the form and calls the server action with new values", async () => {
    updatePropertyMock.mockResolvedValueOnce({ status: "ok", message: "Saved." });
    const user = userEvent.setup();

    render(
      <PropertyEditForm
        propertyId="abc"
        initial={INITIAL}
        reference="BAZ-AD-04891"
        areas={[]}
        developers={DEVELOPERS}
        geo={null}
        mapboxAvailable={false}
      />,
    );

    const titleInput = screen.getByLabelText(/title/i);
    await user.clear(titleInput);
    await user.type(titleInput, "Mamsha · 3-bed beachfront (refined)");

    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(updatePropertyMock).toHaveBeenCalledTimes(1));
    expect(updatePropertyMock).toHaveBeenCalledWith(
      "abc",
      expect.objectContaining({
        title: "Mamsha · 3-bed beachfront (refined)",
        price_aed: INITIAL.price_aed,
      }),
    );
    expect(toast.success).toHaveBeenCalledWith("Saved.");
  });

  // Note: the developer picker's instant-save can't be exercised here —
  // Radix's Select never opens under jsdom (no pointer/layout APIs). It's
  // covered by the publish-gate specs plus the e2e admin flow.

  it("surfaces a validation failure that lives in a collapsed tab", async () => {
    const user = userEvent.setup();

    render(
      <PropertyEditForm
        propertyId="abc"
        initial={INITIAL}
        reference="BAZ-AD-04891"
        areas={[]}
        developers={DEVELOPERS}
        geo={null}
        mapboxAvailable={false}
      />,
    );

    // Break the slug (SEO tab), then Save from the Overview tab.
    await user.click(screen.getByRole("tab", { name: /seo/i }));
    const slugInput = screen.getByLabelText(/url slug/i);
    await user.clear(slugInput);
    await user.type(slugInput, "Not A Slug");
    await user.click(screen.getByRole("tab", { name: /overview/i }));

    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(updatePropertyMock).not.toHaveBeenCalled();
    // Jumped back to the tab that owns the bad field instead of no-opping.
    expect(screen.getByRole("tab", { name: /seo/i })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("surfaces server-side field errors back into the form", async () => {
    updatePropertyMock.mockResolvedValueOnce({
      status: "error",
      message: "Please fix the errors below.",
      fieldErrors: { title: "Title already taken" },
    });
    const user = userEvent.setup();

    render(
      <PropertyEditForm
        propertyId="abc"
        initial={INITIAL}
        reference="BAZ-AD-04891"
        areas={[]}
        developers={DEVELOPERS}
        geo={null}
        mapboxAvailable={false}
      />,
    );

    const titleInput = screen.getByLabelText(/title/i);
    await user.type(titleInput, " v2");
    await user.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() =>
      expect(screen.getByText("Title already taken")).toBeInTheDocument(),
    );
    expect(toast.error).toHaveBeenCalledWith("Please fix the errors below.");
  });
});
