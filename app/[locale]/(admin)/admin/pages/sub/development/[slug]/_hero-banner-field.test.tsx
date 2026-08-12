import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MasterPageEditor } from "../../../master/[key]/_editor";
import { DEVELOPMENT_SECTIONS } from "@/lib/master-pages/subpages";
import { resolveSections, type MasterPageDef } from "@/lib/master-pages";
import { developmentPageDef } from "@/lib/master-pages/subpages";

// The editor holds server actions by reference; that module reaches for the
// Supabase server client and next/cache, neither of which belongs in jsdom.
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const MEDIA = [
  {
    id: "m1",
    filename: "canopies-hero-wide.jpg",
    url: "https://cdn.test/canopies-hero-wide.jpg",
    mime: "image/jpeg",
  },
];

function setup() {
  const def = developmentPageDef({
    name: "The Canopies at Yas Point",
    slug: "the-canopies-at-yas-point-aldar",
  });
  const sections = resolveSections(def as MasterPageDef, null);
  const view = render(
    <MasterPageEditor
      pageKey="the-canopies-at-yas-point-aldar"
      pageLabel="The Canopies at Yas Point"
      path="/developments/the-canopies-at-yas-point-aldar"
      usingDefaults
      media={MEDIA}
      seeds={{}}
      actions={{ save: vi.fn(), reset: vi.fn() }}
      allowReorder
      initial={sections.map((s) => ({
        key: s.key,
        def: s.def,
        enabled: s.enabled,
        values: s.values,
      }))}
    />,
  );
  // Sections start collapsed; the Hero is the first row.
  fireEvent.click(screen.getAllByLabelText("Expand")[0]);
  return view;
}

describe("the Hero section's banner picker", () => {
  it("is offered in the sub-page editor", () => {
    setup();
    expect(screen.getByText("Hero banner")).toBeTruthy();
  });

  it("says what happens when it is left empty", () => {
    // The fallback is the whole reason this shipped without a backfill — an
    // editor should be able to read that off the field, not infer it.
    setup();
    const help = screen.getByText(/Blank falls back to the cover image/i);
    expect(help).toBeTruthy();
  });

  it("starts on the cover-image fallback rather than a picked asset", () => {
    setup();
    const picker = screen
      .getByText("Hero banner")
      .closest("div")!.parentElement!;
    const select = picker.querySelector("select") as HTMLSelectElement;
    expect(select.value).toBe("");
    expect(
      [...select.options].some((o) => o.textContent === MEDIA[0].filename),
    ).toBe(true);
  });

  it("keeps the hero section undeletable — it is the top of the page", () => {
    const hero = DEVELOPMENT_SECTIONS.find((s) => s.key === "hero")!;
    expect(hero.locked).toBe(true);
  });
});
