import { beforeAll, describe, expect, it, vi } from "vitest";
import { render as rtlRender, screen } from "@testing-library/react";
import { IntlHarness } from "@/lib/i18n/test-utils";
import { PreferencesProvider } from "@/lib/preferences";
import { BLOCK_DEFS, newBlockInstance } from "./catalogue";
import { resolveDocument } from "./document";
import { EMPTY_LANDING_DATA, type LandingData } from "./data";
import { presetBlocks, PRESETS } from "./presets";
import {
  BlockNode,
  LandingRenderer,
} from "@/app/[locale]/(public)/lp/[slug]/_render";
import type { BlockDef } from "./types";
import type { ListingRow } from "@/lib/queries/properties";
import type { SectionValues } from "@/lib/master-pages";

/**
 * Every catalogue block actually renders.
 *
 * The unit specs above check the *data* path — what a block declares, what the
 * adapter produces, what the gate refuses. This one checks the half they
 * can't: that the component on the other end of each adapter accepts those
 * props and produces DOM. Without it the first time anyone learns that a
 * catalogue entry and its component disagree is when a marketing manager adds
 * the section and the page 500s.
 */

// The blocks reach for the two async server pieces the renderer composes.
// Neither belongs in jsdom, and neither is what this spec is testing.
vi.mock("@/app/[locale]/(public)/_components/forms/form-renderer", () => ({
  FormRenderer: ({ form }: { form: { key: string } }) => (
    <div data-testid="form">{form.key}</div>
  ),
}));
vi.mock("@/app/[locale]/(public)/_components/home/off-plan-projects", () => ({
  OffPlanProjects: ({ heading }: { heading?: string }) => (
    <section data-testid="off-plan">{heading}</section>
  ),
}));

beforeAll(() => {
  // jsdom implements neither, and `FeatureRow` uses both: matchMedia to honour
  // prefers-reduced-motion, IntersectionObserver to drive its scroll reveal.
  // Real browser behaviour, not something this spec is testing.
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;

  window.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
    root = null;
    rootMargin = "";
    thresholds = [];
  } as unknown as typeof window.IntersectionObserver;
});

/**
 * `PreferencesProvider` lives in app/layout.tsx, so it wraps /lp/[slug] in the
 * real app. Currency- and unit-aware cards read from it.
 */
function render(ui: React.ReactElement) {
  // ListingCard reads the `listing` namespace, so the tree needs an intl
  // provider as well as preferences.
  return rtlRender(
    <IntlHarness>
      <PreferencesProvider>{ui}</PreferencesProvider>
    </IntlHarness>,
  );
}

function listing(reference: string): ListingRow {
  return {
    id: `id-${reference}`,
    reference,
    title: `Listing ${reference}`,
    price_aed: 2_500_000,
    beds: 3,
    baths: 3,
    built_up_ft2: 2100,
    areas: { name: "Saadiyat Island" },
    hero: null,
  } as unknown as ListingRow;
}

const DATA: LandingData = {
  ...EMPTY_LANDING_DATA,
  propertiesByRef: new Map([["REF-1", listing("REF-1")]]),
  propertiesByQuery: new Map([["new_this_week:4", [listing("Q-1")]]]),
  developments: [],
  forms: {
    contact_enquiry: { key: "contact_enquiry", enabled: true } as never,
  },
};

/**
 * Values that exercise a block's real shape rather than its empty defaults —
 * every list-driven block renders nothing until it has an item, and "renders
 * nothing" is not what this spec is trying to prove.
 */
const FILLED: Record<string, SectionValues> = {
  hero_media: {
    title: "Saadiyat Lagoons",
    stats: [{ value: "120", label: "Units" }],
  },
  hero_form: { form_key: "contact_enquiry" },
  featured_properties: { source: "picked", picks: [{ slug: "REF-1" }] },
  featured_developments: { picks: [{ slug: "one" }] },
  feature_scroll: {
    items: [
      { kicker: "views", title: "The views", copy: "Water on three sides." },
      { kicker: "plan", title: "The plan", copy: "Two towers, one podium." },
    ],
  },
  tiles: {
    items: [
      {
        name: "Villas",
        desc: "Four to six beds.",
        cta: "Browse",
        href: "/buy",
      },
    ],
  },
  prop_types: {
    cols: "4",
    items: [{ name: "Townhouse", desc: "Three beds.", href: "/buy" }],
  },
  steps: { items: [{ title: "Register", desc: "Tell us the brief." }] },
  faq: { items: [{ q: "When is handover?", a: "Q4 2027." }] },
  rich_text: { body: "First paragraph.\n\nSecond paragraph." },
  image_band: { caption: "Corniche at dusk" },
  form_band: { form_key: "contact_enquiry" },
  cta_band: { cta2_label: "Call us", cta2_href: "tel:+9715" },
  chips: { items: [{ label: "Saadiyat", href: "/areas/saadiyat-island" }] },
  about_bazar: { stats: [{ value: "20+", label: "Years" }] },
  why_band: { stats: [{ value: "20+", label: "Years" }] },
};

function filled(def: BlockDef) {
  const instance = newBlockInstance(def);
  return {
    ...instance,
    values: { ...instance.values, ...(FILLED[def.key] ?? {}) },
  };
}

describe("every catalogue block renders", () => {
  for (const def of BLOCK_DEFS) {
    it(`${def.key} produces DOM`, () => {
      const [block] = resolveDocument([filled(def)]);
      const { container } = render(<BlockNode block={block} data={DATA} />);
      expect(
        container.textContent?.trim().length ?? 0,
        `${def.key} rendered nothing — the adapter and the component disagree`,
      ).toBeGreaterThan(0);
    });
  }
});

describe("blocks with nothing to show", () => {
  it("render nothing rather than an orphan heading", () => {
    // A rail whose picks were all unpublished, and list blocks nobody filled
    // in. Each must disappear entirely — a heading over an empty grid reads as
    // a broken page.
    for (const key of [
      "featured_properties",
      "tiles",
      "faq",
      "steps",
      "chips",
    ]) {
      const def = BLOCK_DEFS.find((d) => d.key === key)!;
      const [block] = resolveDocument([newBlockInstance(def)]);
      const { container } = render(
        <BlockNode block={block} data={EMPTY_LANDING_DATA} />,
      );
      expect(container.textContent?.trim(), key).toBe("");
    }
  });
});

describe("LandingRenderer", () => {
  it("draws enabled blocks in document order", () => {
    const blocks = resolveDocument([
      filled(BLOCK_DEFS.find((d) => d.key === "faq")!),
      filled(BLOCK_DEFS.find((d) => d.key === "cta_band")!),
    ]);
    render(<LandingRenderer blocks={blocks} data={DATA} />);
    const headings = screen.getAllByRole("heading");
    const text = headings.map((h) => h.textContent).join(" | ");
    expect(text.indexOf("Frequently asked")).toBeLessThan(
      text.indexOf("Ready when you are"),
    );
  });

  it("skips a hidden block", () => {
    const blocks = resolveDocument([
      { ...filled(BLOCK_DEFS.find((d) => d.key === "faq")!), enabled: false },
    ]);
    const { container } = render(
      <LandingRenderer blocks={blocks} data={DATA} />,
    );
    expect(container.textContent?.trim()).toBe("");
  });

  it("skips a block this build doesn't know without throwing", () => {
    const blocks = resolveDocument([
      { id: "u", type: "market_stats_strip", v: 1, enabled: true, values: {} },
      filled(BLOCK_DEFS.find((d) => d.key === "faq")!),
    ]);
    render(<LandingRenderer blocks={blocks} data={DATA} />);
    expect(screen.getByText("Frequently asked")).toBeTruthy();
  });

  it("carries the blowout guard on the page wrapper", () => {
    // One section's runaway grid track must not be able to make the whole page
    // scroll sideways on a phone.
    const { container } = render(
      <LandingRenderer blocks={[]} data={EMPTY_LANDING_DATA} />,
    );
    expect(container.firstElementChild?.className).toContain("overflow-x-clip");
    expect(container.firstElementChild?.className).toContain("[&>*]:min-w-0");
  });

  it("renders exactly one h1 for each preset", () => {
    for (const preset of PRESETS) {
      if (preset.blocks.length === 0) continue;
      const blocks = resolveDocument(
        presetBlocks(preset.key).map((b) => ({
          ...b,
          values: { ...b.values, ...(FILLED[b.type] ?? {}) },
        })),
      );
      const { container, unmount } = render(
        <LandingRenderer blocks={blocks} data={DATA} />,
      );
      expect(container.querySelectorAll("h1"), preset.key).toHaveLength(1);
      unmount();
    }
  });
});
