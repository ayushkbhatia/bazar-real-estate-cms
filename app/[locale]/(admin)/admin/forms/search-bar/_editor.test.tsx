import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("./_actions", () => ({
  saveSearchBar: vi.fn(),
  resetSearchBar: vi.fn(),
}));

import { SearchBarEditor } from "./_editor";
import { SEARCH_BAR_COPY_KEYS, defaultResolvedSearchBar } from "@/lib/search-bar";

/**
 * The admin route is auth-gated, so this is where the editor is actually
 * exercised. What it holds is the promise the section was built on: an editor
 * can reach every string the home page's search bar renders, in both
 * languages. A control that quietly stops being drawn — the way the four
 * field-level twins did in #390 — takes its Arabic offline with it, silently.
 */

const BAR = defaultResolvedSearchBar();
const DEFAULTS = Object.fromEntries(
  SEARCH_BAR_COPY_KEYS.map(({ key }) => [key, `catalogue ${key}`]),
);

function mount() {
  return render(<SearchBarEditor bar={BAR} defaults={DEFAULTS} />);
}

describe("the tab list", () => {
  it("draws one row per registry tab, in order", () => {
    mount();
    for (const tab of BAR.tabs) {
      expect(screen.getByText(tab.label)).toBeInTheDocument();
    }
  });

  it("opens the first tab with its label, key, route and placeholder", () => {
    mount();
    const first = BAR.tabs[0];
    expect(screen.getByDisplayValue(first.label)).toBeInTheDocument();
    expect(screen.getByDisplayValue(first.key)).toBeInTheDocument();
    expect(screen.getByDisplayValue(first.route)).toBeInTheDocument();
    expect(screen.getByDisplayValue(first.placeholder)).toBeInTheDocument();
  });

  it("draws every property type the open tab offers", () => {
    mount();
    for (const type of BAR.tabs[0].types) {
      expect(screen.getByDisplayValue(type.label)).toBeInTheDocument();
    }
  });

  /*
   * One per translatable string on the open tab: its label, its placeholder
   * and each of its four property types. An Arabic box that stops being drawn
   * is not a cosmetic loss — the whole point of this section is that /ar can
   * be edited, and the twins are written back from what the editor holds.
   */
  it("puts an Arabic box beside each of them", () => {
    mount();
    const arabic = screen.getAllByRole("button", { name: /العربية/ });
    expect(arabic.length).toBe(2 + BAR.tabs[0].types.length);
  });
});

describe("the shared labels", () => {
  it("offers an override for every copy key, blank, with the catalogue behind it", async () => {
    const { getByRole } = mount();
    getByRole("button", { name: "Labels & CTA" }).click();
    // React 19 flushes the click synchronously in the test env; re-query after.
    const found = await screen.findByPlaceholderText("catalogue submit_label");
    expect(found).toHaveValue("");

    for (const { key } of SEARCH_BAR_COPY_KEYS) {
      expect(
        screen.getByPlaceholderText(`catalogue ${key}`),
      ).toBeInTheDocument();
    }
  });
});

describe("the header", () => {
  it("says the built-in setup is what is live when nothing is stored", () => {
    mount();
    expect(
      screen.getByText(/Nothing saved yet/),
    ).toBeInTheDocument();
  });

  it("disables 'revert' when there is nothing to revert to", () => {
    mount();
    expect(
      screen.getByRole("button", { name: /Revert to built-in/ }),
    ).toBeDisabled();
  });
});

describe("what an editor is refused", () => {
  it("cannot move the first tab up or the last one down", () => {
    mount();
    const ups = screen.getAllByRole("button", { name: "Move up" });
    const downs = screen.getAllByRole("button", { name: "Move down" });
    expect(ups[0]).toBeDisabled();
    expect(downs[downs.length - 1]).toBeDisabled();
    expect(ups[1]).not.toBeDisabled();
  });

  it("offers only real property types in the value dropdown", () => {
    mount();
    const selects = screen.getAllByRole("combobox");
    const options = within(selects[0])
      .getAllByRole("option")
      .map((o) => (o as HTMLOptionElement).value);
    expect(options).toContain("apartment");
    expect(options).not.toContain("chalet");
  });
});
