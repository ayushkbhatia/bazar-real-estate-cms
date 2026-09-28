import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { IntlHarness } from "@/lib/i18n/test-utils";
import { PreferencesProvider } from "@/lib/preferences";
import type { Locale } from "@/lib/i18n/locales";
import { calculatorOptions } from "@/lib/developments/calculator-options";
import type { PaymentPlan } from "@/lib/schemas/development";
import { PaymentPlanSection } from "./_payment-plan";

/**
 * The calculator's "Pricing for" dropdown: it opens on the project's starting
 * price, offers every priced unit type and unit on sale beside it, and
 * re-prices the schedule against whichever the visitor picks.
 */

const PLAN: PaymentPlan = {
  name: "50/50 Payment Plan",
  milestones: [
    { percent: 50, label: "During construction", timing: "" },
    { percent: 50, label: "On handover", timing: "" },
  ],
};

const OPTIONS = calculatorOptions({
  startingPrice: 1_000_000,
  unitTypes: [
    { id: "t2", label: "2 Bedroom", beds: 2, sizeFromFt2: 1250, priceFromAed: 2_000_000 },
  ],
  units: [
    { id: "u1", unitType: "Villa", beds: 4, builtUpFt2: 5000, priceAed: 4_000_000 },
  ],
});

function draw(units = OPTIONS, locale: Locale = "en" as Locale) {
  return render(
    <IntlHarness locale={locale}>
      <PreferencesProvider>
        <PaymentPlanSection
          id="payment-plan"
          plan={PLAN}
          heading="Payment plan"
          developmentName="Yas Riva"
          units={units}
        />
      </PreferencesProvider>
    </IntlHarness>,
  );
}

const select = () => screen.getByRole("combobox") as HTMLSelectElement;

describe("PaymentPlanSection · pricing dropdown", () => {
  it("opens on the starting price, then unit types, then units on sale", () => {
    draw();
    expect(select().value).toBe("starting-price");
    const labels = [...select().options].map((o) => o.textContent);
    expect(labels[0]).toMatch(/^Starting price · /);
    expect(labels[1]).toMatch(/^2 Bedroom · .* · from /);
    expect(labels[2]).toMatch(/^Villa · 4-bed · /);
    // Types and inventory together get headed groups; the starting price
    // stays alone on top.
    const groups = [...select().querySelectorAll("optgroup")].map((g) =>
      g.getAttribute("label"),
    );
    expect(groups).toEqual(["Unit types", "Available units"]);
  });

  it("re-prices the schedule against the option picked", () => {
    const { container } = draw();
    const figures = () =>
      within(container.querySelector("ol")!).getAllByText(/\d/, {
        selector: ".mono",
      });
    const before = figures().map((n) => n.textContent);
    fireEvent.change(select(), { target: { value: "type-t2" } });
    const after = figures().map((n) => n.textContent);
    expect(after).not.toEqual(before);
    // 50% of AED 2M, however the visitor's preferences write it.
    expect(after[0]).toMatch(/1(\.0+)?\s*M|1,000,000/);
  });

  it("lists a single kind flat, with no group headings", () => {
    draw(
      calculatorOptions({
        startingPrice: 1_000_000,
        unitTypes: [
          { id: "t2", label: "2 Bedroom", beds: 2, sizeFromFt2: null, priceFromAed: 2_000_000 },
        ],
        units: [],
      }),
    );
    expect(select().querySelectorAll("optgroup")).toHaveLength(0);
    expect(select().options).toHaveLength(2);
  });

  it("writes the options in Arabic on /ar", () => {
    draw(OPTIONS, "ar" as Locale);
    const labels = [...select().options].map((o) => o.textContent ?? "");
    expect(labels[0]).toContain("سعر البداية");
    expect(labels[1]).toContain("ابتداءً من");
    expect(labels.join(" ")).not.toMatch(/Starting price|from |-bed/);
  });
});
