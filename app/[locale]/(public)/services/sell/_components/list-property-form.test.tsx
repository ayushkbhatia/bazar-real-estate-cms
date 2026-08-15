// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
// The form reads the `forms` namespace now, so a bare `render()` throws
// "No intl context found" rather than failing an assertion.
import { renderWithIntl as render } from "@/lib/i18n/test-utils";
import userEvent from "@testing-library/user-event";
import { ListPropertyForm, type SellFormCopy } from "./list-property-form";

const submitListingLead = vi.fn(async (_input: unknown) => ({
  status: "ok" as const,
  reference: "BZ-SL-48210",
  summary: "For sale · Saadiyat Island · Apartment · 2 bed",
  callWindow: "afternoon" as const,
  advisor: {
    name: "Mariam Al-Hashimi",
    title: "Senior Advisor · Saadiyat",
    brn: "BRN-58219",
    phone: "+97125550001",
    initials: "MA",
    slug: "mariam-al-hashimi",
  },
}));

vi.mock("../_actions", () => ({
  submitListingLead: (input: unknown) => submitListingLead(input),
}));

const AREAS = [
  {
    slug: "saadiyat-island",
    name: "Saadiyat Island",
    parentSlug: null,
    context: "Abu Dhabi",
  },
  {
    slug: "al-reem-island",
    name: "Al Reem Island",
    parentSlug: null,
    context: "Abu Dhabi",
  },
];

function renderForm(copy?: SellFormCopy) {
  return render(
    <ListPropertyForm
      areas={AREAS}
      deskPhone="+971 2 632 2223"
      copy={copy}
    />,
  );
}

/** Drive the two steps and submit. Leaves the confirmation on screen. */
async function submitBrief(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    screen.getByRole("combobox", { name: /location/i }),
    "Saadiyat Island",
  );
  await user.keyboard("{Escape}");
  await user.click(screen.getByRole("button", { name: /^apartment$/i }));
  await user.click(screen.getByRole("button", { name: /^2$/ }));
  await user.click(screen.getByRole("button", { name: /^continue$/i }));

  await user.type(screen.getByLabelText(/^full name/i), "Aisha Al Nuaimi");
  await user.type(screen.getByLabelText(/^mobile/i), "501234567");
  await user.type(screen.getByLabelText(/^email/i), "aisha@example.com");
  await user.click(
    screen.getByRole("button", { name: /match me with an advisor/i }),
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
  submitListingLead.mockClear();
});

describe("ListPropertyForm", () => {
  it("holds the owner on step 1 until the required answers are in", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: /^continue$/i }));

    expect(
      await screen.findByText(/tell us where the property is/i),
    ).toBeInTheDocument();
    // Still step 1 — the contact half must be out of the accessibility tree,
    // not merely off-screen, or it stays tabbable.
    expect(
      screen.queryByRole("button", { name: /match me with an advisor/i }),
    ).toBeNull();
  });

  it("asks for bedrooms on an apartment but not on land", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: /^apartment$/i }));
    expect(screen.getByText(/bedrooms/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^land$/i }));
    expect(screen.queryByText(/bedrooms/i)).toBeNull();
  });

  it("clears the chosen type when the category switches", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: /^villa$/i }));
    expect(screen.getByRole("button", { name: /^villa$/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: /^commercial$/i }));
    // Villa is gone from the DOM; nothing in the commercial list is selected.
    for (const label of ["Office", "Retail", "Warehouse"]) {
      expect(
        screen.getByRole("button", { name: new RegExp(`^${label}$`, "i") }),
      ).toHaveAttribute("aria-pressed", "false");
    }
  });

  it("autocompletes the location and routes the picked area through", async () => {
    const user = userEvent.setup();
    renderForm();

    const location = screen.getByRole("combobox", { name: /location/i });
    await user.type(location, "saad");
    await user.click(await screen.findByRole("option", { name: /saadiyat/i }));

    expect(location).toHaveValue("Saadiyat Island");
  });

  it("carries the whole brief through to the confirmation", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(
      screen.getByRole("combobox", { name: /location/i }),
      "Saadiyat Island",
    );
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: /^apartment$/i }));
    await user.click(screen.getByRole("button", { name: /^2$/ }));
    await user.click(screen.getByRole("button", { name: /^continue$/i }));

    await user.type(screen.getByLabelText(/^full name/i), "Aisha Al Nuaimi");
    await user.type(screen.getByLabelText(/^mobile/i), "501234567");
    await user.type(screen.getByLabelText(/^email/i), "aisha@example.com");
    await user.click(
      screen.getByRole("button", { name: /match me with an advisor/i }),
    );

    await waitFor(() => expect(submitListingLead).toHaveBeenCalledTimes(1));
    expect(submitListingLead).toHaveBeenCalledWith(
      expect.objectContaining({
        intent: "sell",
        location: "Saadiyat Island",
        property_type: "Apartment",
        bedrooms: "2",
        email: "aisha@example.com",
        consent: true,
      }),
    );
    expect(
      await screen.findByText(/mariam will call you this afternoon/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/BZ-SL-48210/)).toBeInTheDocument();
  });

  describe("the confirmation badge", () => {
    /** Same lead, but nobody covers the area — the desk picks it up. */
    const noAdvisor = () =>
      submitListingLead.mockResolvedValueOnce({
        status: "ok" as const,
        reference: "BZ-SL-48211",
        summary: "For sale · Saadiyat Island · Apartment · 2 bed",
        callWindow: "afternoon" as const,
        advisor: null,
      } as never);

    it("draws the uploaded logo when the desk picks the lead up", async () => {
      const user = userEvent.setup();
      noAdvisor();
      renderForm({
        deskAvatarUrl: "https://cdn.example.com/bazar-logo.png",
        deskAvatarAlt: "Bazar Real Estate",
        deskInitials: "BZ",
      });

      await submitBrief(user);

      const logo = await screen.findByAltText("Bazar Real Estate");
      expect(logo).toBeInTheDocument();
      // The monogram is what the logo replaced, so it must be gone.
      expect(screen.queryByText("BZ")).not.toBeInTheDocument();
    });

    it("keeps the monogram when no logo is uploaded", async () => {
      const user = userEvent.setup();
      noAdvisor();
      renderForm({ deskAvatarUrl: null, deskInitials: "BZ" });

      await submitBrief(user);

      expect(await screen.findByText("BZ")).toBeInTheDocument();
    });

    it("leaves a matched advisor their own initials, logo or not", async () => {
      const user = userEvent.setup();
      renderForm({
        deskAvatarUrl: "https://cdn.example.com/bazar-logo.png",
        deskAvatarAlt: "Bazar Real Estate",
      });

      await submitBrief(user);

      // The logo stands in for the desk, never for a named person.
      expect(await screen.findByText("MA")).toBeInTheDocument();
      expect(
        screen.queryByAltText("Bazar Real Estate"),
      ).not.toBeInTheDocument();
    });
  });
});
