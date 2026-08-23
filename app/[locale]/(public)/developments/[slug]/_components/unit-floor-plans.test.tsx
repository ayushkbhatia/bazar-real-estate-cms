import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UnitFloorPlans } from "./unit-floor-plans";
import { PreferencesProvider } from "@/lib/preferences";
import type { PlanCard, UnitTypeCard } from "@/lib/queries/development-unit-plans";

function plan(over: Partial<PlanCard> & { id: string }): PlanCard {
  return {
    label: "Type 1",
    description: null,
    beds: 1,
    baths: 1,
    area_ft2: 900,
    image_url: `https://cdn.test/${over.id}.png`,
    image_alt: null,
    image_key: `brand/${over.id}.png`,
    ...over,
  };
}

function type(over: Partial<UnitTypeCard> & { id: string }): UnitTypeCard {
  return {
    label: "Studio",
    beds: 0,
    blurb: null,
    size_from_ft2: null,
    size_to_ft2: null,
    price_from_aed: null,
    plans: [plan({ id: `${over.id}-a` })],
    placeholder: false,
    ...over,
  };
}

const TYPES: UnitTypeCard[] = [
  type({ id: "studio", label: "Studio" }),
  type({
    id: "one-bed",
    label: "1 Bedroom",
    plans: [
      plan({ id: "one-a", label: "Type 1" }),
      plan({ id: "one-b", label: "Type 2" }),
    ],
  }),
];

function renderSection(over: Partial<Parameters<typeof UnitFloorPlans>[0]> = {}) {
  return render(
    <PreferencesProvider>
      <UnitFloorPlans
        types={TYPES}
        developmentName="The Artery Residences"
        developmentSlug="the-artery-residences"
        gated={false}
        heading={null}
        intro={null}
        eyebrow={null}
        {...over}
      />
    </PreferencesProvider>,
  );
}

describe("UnitFloorPlans", () => {
  /**
   * The performance fix, as an assertion: an unselected type that isn't in the
   * DOM can't have been pre-loaded, so pressing its tab pays for the images.
   */
  it("mounts every type's layouts, not only the selected one", () => {
    renderSection();
    const panels = screen.getAllByRole("tabpanel", { hidden: true });
    expect(panels).toHaveLength(2);
    expect(
      panels.flatMap((p) => within(p).getAllByRole("img", { hidden: true })),
    ).toHaveLength(3);
  });

  it("hides the unselected panels and points each tab at its own", () => {
    renderSection();
    const [studio, oneBed] = screen.getAllByRole("tabpanel", { hidden: true });
    expect(studio).not.toHaveAttribute("hidden");
    expect(oneBed).toHaveAttribute("hidden");
    // One panel each, not every tab pointing at whichever one is showing.
    const controlled = screen
      .getAllByRole("tab")
      .map((tab) => document.getElementById(tab.getAttribute("aria-controls")!));
    expect(controlled).toEqual([studio, oneBed]);
  });

  it("swaps which panel is hidden without unmounting the other", async () => {
    renderSection();
    const before = screen.getAllByRole("tabpanel", { hidden: true });
    await userEvent.click(screen.getByRole("tab", { name: "1 Bedroom" }));
    const after = screen.getAllByRole("tabpanel", { hidden: true });
    expect(after[0]).toBe(before[0]);
    expect(after[1]).toBe(before[1]);
    expect(after[0]).toHaveAttribute("hidden");
    expect(after[1]).not.toHaveAttribute("hidden");
  });

  /** No separate control: the drawing itself is the trigger. */
  it("opens the layout full screen from the image, with no enlarge button", async () => {
    renderSection();
    expect(screen.queryByRole("button", { name: /enlarge/i })).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Type 1 — open full screen" }),
    );
    const dialog = screen.getByRole("dialog");
    // Asserts the modal CONTRACT, not the `aria-modal` attribute.
    //
    // This used to read `toHaveAttribute("aria-modal", "true")`, which the
    // hand-rolled overlay satisfied by writing the attribute on a plain div
    // while enforcing none of what it claims. Measured on the sibling gallery
    // before it was converted: the page scrolled 600px behind the open
    // lightbox and 12 of 15 tabs escaped it. The attribute was decoration.
    //
    // Radix does not set `aria-modal` — it takes the other route the spec
    // allows, marking the rest of the tree `aria-hidden` and holding focus.
    // So the honest assertion is that focus actually moved inside, which the
    // old markup would have failed and this one passes.
    expect(dialog.contains(document.activeElement)).toBe(true);
    // `selector: "p"` picks the VISIBLE caption. The overlay moved onto Radix
    // Dialog, which requires a Dialog.Title — it renders as an `sr-only` <h2>
    // carrying the same layout name, so a bare getByText now matches twice.
    // Both are wanted: the heading names the dialog for a screen reader, the
    // paragraph shows the caption. This asserts the one a sighted user reads.
    expect(
      within(dialog).getByText(/Studio · Type 1/, { selector: "p" }),
    ).toBeInTheDocument();
  });

  it("walks the open type's other layouts and closes on Escape", async () => {
    renderSection();
    await userEvent.click(screen.getByRole("tab", { name: "1 Bedroom" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Type 1 — open full screen" }),
    );
    const dialog = screen.getByRole("dialog");
    // `selector: "p"` — see the note in the test above; Radix's Dialog.Title
    // renders the same name a second time as an sr-only heading.
    expect(
      within(dialog).getByText(/1 Bedroom · Type 1/, { selector: "p" }),
    ).toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Next layout" }),
    );
    expect(
      within(dialog).getByText(/1 Bedroom · Type 2/, { selector: "p" }),
    ).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("");
  });

  /** The gated variant blurs the drawing behind a lead form — it must not open. */
  it("leaves gated layouts behind the request form", () => {
    renderSection({ gated: true });
    expect(screen.queryByRole("button", { name: /open full screen/i })).toBeNull();
    expect(
      screen.getAllByRole("button", { name: /request layout/i }).length,
    ).toBeGreaterThan(0);
  });
});
