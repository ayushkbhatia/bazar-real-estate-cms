import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { toOptions, type AmenityOption } from "@/lib/amenities";
import type { AmenityTaxonomyEntry } from "@/lib/schemas/amenity-taxonomy";
import { AmenitiesPicker } from "./amenities-picker";

/**
 * The picker's new job: a value it does not recognise becomes a taxonomy ROW,
 * not free text on one listing. That distinction is the whole reason an
 * amenity can have Arabic at all — `amenities_taxonomy.label_ar` is the only
 * column that holds it, so a value stored beside the taxonomy is a word that
 * renders English on /ar for ever.
 */

const TAXONOMY: AmenityTaxonomyEntry[] = [
  { code: "pool", label: "Pool", label_ar: "مسبح", category: "outdoor", icon: null, sort_order: 10, active: true },
  { code: "gym", label: "Gym", label_ar: null, category: "wellness", icon: null, sort_order: 20, active: true },
];
const OPTIONS = toOptions(TAXONOMY);

function mount(
  onAddToTaxonomy?: Parameters<typeof AmenitiesPicker>[0]["onAddToTaxonomy"],
  initial: string[] = [],
) {
  const state = { value: initial };
  const onChange = vi.fn((next: string[]) => {
    state.value = next;
  });
  const view = render(
    <AmenitiesPicker
      value={state.value}
      options={OPTIONS}
      onChange={onChange}
      onAddToTaxonomy={onAddToTaxonomy}
    />,
  );
  return { view, onChange, state };
}

const CREATED: AmenityOption = {
  code: "wine_cellar",
  label: "Wine cellar",
  label_ar: "قبو نبيذ",
  category: "indoor",
};

describe("AmenitiesPicker · adding to the taxonomy", () => {
  it("asks for a category and the Arabic before writing the row", async () => {
    const user = userEvent.setup();
    const add = vi.fn(async () => ({ status: "created" as const, option: CREATED }));
    const { onChange } = mount(add);

    await user.type(
      screen.getByLabelText(/filter amenities/i),
      "Wine cellar",
    );
    await user.click(screen.getByRole("button", { name: /Add “Wine cellar”/ }));

    // The panel, not a silent write: two of the three things the row needs are
    // not in the search box.
    const arabic = await screen.findByPlaceholderText("اسم الميزة بالعربية");
    await user.selectOptions(screen.getByLabelText("Category"), "indoor");
    await user.type(arabic, "قبو نبيذ");
    await user.click(screen.getByRole("button", { name: "Add amenity" }));

    await waitFor(() =>
      expect(add).toHaveBeenCalledWith({
        label: "Wine cellar",
        label_ar: "قبو نبيذ",
        category: "indoor",
      }),
    );
    // Ticked on the listing too — the row is no use if the lister has to go
    // find it again.
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(["Wine cellar"]),
    );
  });

  it("keeps the typed value on the listing when the write fails", async () => {
    const user = userEvent.setup();
    const add = vi.fn(async () => ({
      status: "error" as const,
      message: "Couldn’t add it to the amenity list.",
    }));
    const { onChange } = mount(add);

    await user.type(screen.getByLabelText(/filter amenities/i), "Wine cellar");
    await user.click(screen.getByRole("button", { name: /Add “Wine cellar”/ }));
    await user.click(await screen.findByRole("button", { name: "Add amenity" }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(["Wine cellar"]));
    expect(
      await screen.findByText(/Kept it on this listing only/),
    ).toBeTruthy();
  });

  it("ticks the existing card instead of opening the panel for a known label", async () => {
    const user = userEvent.setup();
    const add = vi.fn();
    const { onChange } = mount(add);

    await user.type(screen.getByLabelText(/filter amenities/i), "pool");
    // No "Add" button at all — the card is right there.
    expect(screen.queryByRole("button", { name: /^Add “/ })).toBeNull();
    // The filter leaves one card standing.
    await user.click(screen.getByRole("checkbox"));
    expect(add).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith(["Pool"]);
  });

  it("writes free text when no taxonomy writer is wired up", async () => {
    const user = userEvent.setup();
    const { onChange } = mount(undefined);

    await user.type(screen.getByLabelText(/filter amenities/i), "Wine cellar");
    await user.click(
      screen.getByRole("button", { name: /Add “Wine cellar”/ }),
    );
    expect(screen.queryByText(/to the amenity list$/)).toBeNull();
    expect(onChange).toHaveBeenCalledWith(["Wine cellar"]);
  });
});
