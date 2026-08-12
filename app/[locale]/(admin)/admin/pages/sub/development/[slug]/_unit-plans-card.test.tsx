import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DevelopmentUnitPlansCard } from "./_unit-plans-card";
import { blankUnitType } from "@/lib/schemas/development-unit-plans";

// The card holds the server actions by reference; that module reaches for the
// Supabase server client and next/cache, neither of which belongs in jsdom.
const saveDevelopmentUnitPlans = vi.fn();
vi.mock("../_unit-actions", () => ({
  saveDevelopmentUnitPlans: (...args: unknown[]) =>
    saveDevelopmentUnitPlans(...args),
  seedDevelopmentUnitPlans: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function setup(initial = [blankUnitType("2 Bedroom", 2)]) {
  return render(
    <DevelopmentUnitPlansCard
      slug="bayviews-saadiyat"
      initial={initial}
      media={[]}
      bedroomsText="1 - 3"
    />,
  );
}

beforeEach(() => {
  saveDevelopmentUnitPlans
    .mockReset()
    .mockResolvedValue({ status: "ok", message: "Saved." });
});

describe("DevelopmentUnitPlansCard — bedroom and bathroom counts", () => {
  it("takes a bedroom count past the eight the quick-add menu offers", () => {
    // Was a <select> of 0-7, so a 12-bedroom type could not be entered at all.
    setup();
    const beds = screen.getByLabelText("Bedrooms");
    expect(beds).toHaveAttribute("type", "number");
    expect(beds).not.toHaveAttribute("max");

    fireEvent.change(beds, { target: { value: "12" } });
    expect(beds).toHaveValue(12);
  });

  it("takes a bathroom count past 9 and sends it to the action", async () => {
    // The reported bug: "Too big: expected number to be <=9".
    setup();
    fireEvent.change(screen.getByLabelText("Layout 1 bathrooms"), {
      target: { value: "16" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Save units/ }));

    await vi.waitFor(() => expect(saveDevelopmentUnitPlans).toHaveBeenCalled());
    const [, payload] = saveDevelopmentUnitPlans.mock.calls[0]!;
    expect(payload.unit_types[0].plans[0].baths).toBe(16);
  });

  it("leaves the bedroom count blank for a type sold by name", () => {
    // A penthouse maps to no bedroom count; the old dropdown said so with an
    // option, the number field says it with an empty value.
    setup([blankUnitType("Penthouse", null)]);
    const beds = screen.getByLabelText("Bedrooms");
    expect(beds).toHaveValue(null);
    expect(beds).toHaveAttribute("placeholder", "Not a bedroom count");
  });

  it("still refuses a negative count at the spinner", () => {
    setup();
    expect(screen.getByLabelText("Bedrooms")).toHaveAttribute("min", "0");
    expect(screen.getByLabelText("Layout 1 bathrooms")).toHaveAttribute(
      "min",
      "0",
    );
  });
});
