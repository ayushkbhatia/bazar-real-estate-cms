import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { filterRecordOptions, RecordPicker } from "./record-picker";
import { propertySeedItem } from "./record-seeds";
import type { PropertyOption } from "@/lib/queries/featured-properties";

/**
 * The listing picker.
 *
 * The bug: three live listings are titled "Yas Riva Reserve", all on Yas
 * Island, and the picker could only print a title — so an editor chose between
 * identical lines. These specs hold the fix to what it has to do: show what
 * tells the three apart, find a listing by any of it, and refuse a duplicate.
 */

beforeAll(() => {
  // Radix positions the popover with floating-ui, which observes its anchor.
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof window.ResizeObserver;
  Element.prototype.scrollIntoView = () => {};
});

function listing(over: Partial<PropertyOption>): PropertyOption {
  return {
    id: "44444444-0000-0000-0000-000000000001",
    reference: "BAZ-AD-08128",
    slug: "yas-riva-reserve",
    title: "Yas Riva Reserve",
    areaName: "Yas Island",
    mode: "buy",
    type: "villa",
    beds: 6,
    baths: 10,
    builtUpFt2: 6555,
    priceAed: 14_500_000,
    heroUrl: null,
    ...over,
  };
}

// The three production listings that share a title, as the picker gets them.
const OPTIONS = [
  listing({}),
  listing({ reference: "BAZ-AD-01445", beds: 5, baths: 8, builtUpFt2: 5942, priceAed: 13_300_000 }),
  listing({ reference: "BAZ-AD-03688", builtUpFt2: 5791, priceAed: 10_500_000, mode: "rent" }),
].map(propertySeedItem);

describe("propertySeedItem", () => {
  it("keeps the title as the name and puts what tells listings apart in the detail", () => {
    const item = OPTIONS[1]!;
    expect(item.name).toBe("Yas Riva Reserve");
    expect(item.slug).toBe("BAZ-AD-01445");
    expect(item.detail).toMatchObject({
      code: "BAZ-AD-01445",
      sub: "Villa · Yas Island",
      facts: ["5 bed", "8 bath", "5,942 ft²"],
      price: "AED 13.3M",
      badge: "For sale",
    });
    // The live page, by its canonical URL.
    expect(item.detail?.href).toBe("/p/yas-riva-reserve-baz-ad-01445");
  });
});

describe("filterRecordOptions", () => {
  it("finds a listing by its reference", () => {
    expect(filterRecordOptions(OPTIONS, "01445").map((o) => o.slug)).toEqual([
      "BAZ-AD-01445",
    ]);
  });

  it("matches every word, in any order", () => {
    expect(filterRecordOptions(OPTIONS, "5 bed yas").map((o) => o.slug)).toEqual([
      "BAZ-AD-01445",
    ]);
    expect(filterRecordOptions(OPTIONS, "rent villa").map((o) => o.slug)).toEqual([
      "BAZ-AD-03688",
    ]);
  });

  it("matches a figure typed without its comma", () => {
    expect(filterRecordOptions(OPTIONS, "5942").map((o) => o.slug)).toEqual([
      "BAZ-AD-01445",
    ]);
  });

  it("returns everything for an empty query", () => {
    expect(filterRecordOptions(OPTIONS, "  ")).toHaveLength(3);
  });
});

describe("RecordPicker", () => {
  function setup(value = "", taken: string[] = []) {
    const onChange = vi.fn();
    render(
      <RecordPicker
        options={OPTIONS}
        value={value}
        onChange={onChange}
        label="Listing"
        placeholder="Choose a listing"
        taken={taken}
        noun="listing"
      />,
    );
    return onChange;
  }

  function open() {
    fireEvent.click(screen.getByRole("button", { name: /^Listing:/ }));
    return screen.getByRole("listbox", { name: "Listing" });
  }

  it("shows the picked listing's reference and price, not just its title", () => {
    setup("BAZ-AD-03688");
    const trigger = screen.getByRole("button", { name: /^Listing:/ });
    expect(trigger).toHaveAccessibleName(
      "Listing: Yas Riva Reserve, BAZ-AD-03688. Change",
    );
    expect(trigger.textContent).toContain("AED 10.5M");
    expect(trigger.textContent).toContain("For rent");
  });

  it("lists every option with the detail that tells them apart", () => {
    setup();
    const list = open();
    const options = within(list).getAllByRole("option");
    expect(options).toHaveLength(3);
    expect(options.map((o) => o.textContent)).toEqual([
      expect.stringContaining("BAZ-AD-08128"),
      expect.stringContaining("5 bed"),
      expect.stringContaining("AED 10.5M"),
    ]);
  });

  it("narrows as the editor types, and picks with the keyboard", () => {
    const onChange = setup();
    open();
    const search = screen.getByRole("combobox", { name: "Search listings" });
    fireEvent.change(search, { target: { value: "13.3m" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("BAZ-AD-01445");
  });

  it("offers a listing already in the rail, but won't pick it twice", () => {
    const onChange = setup("", ["BAZ-AD-08128"]);
    open();
    const taken = screen
      .getAllByRole("option")
      .find((o) => o.textContent?.includes("BAZ-AD-08128"))!;
    expect(taken).toHaveAttribute("aria-disabled", "true");
    expect(taken.textContent).toContain("Already added");
    fireEvent.click(taken);
    expect(onChange).not.toHaveBeenCalled();
    // The keyboard skips it too: the first ArrowDown from the top lands on
    // the second listing, not the taken first one.
    const search = screen.getByRole("combobox", { name: "Search listings" });
    fireEvent.keyDown(search, { key: "Home" });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("BAZ-AD-01445");
  });

  it("keeps a pick that is no longer published, and says so", () => {
    setup("BAZ-AD-99999");
    expect(screen.getByText("BAZ-AD-99999")).toBeInTheDocument();
    expect(screen.getByText(/isn't published any more/)).toBeInTheDocument();
  });

  it("clears the pick", () => {
    const onChange = setup("BAZ-AD-08128");
    fireEvent.click(screen.getByRole("button", { name: "Clear Listing" }));
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
