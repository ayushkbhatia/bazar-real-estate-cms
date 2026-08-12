import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  MASTER_PAGES,
  isListField,
  isSelectField,
  isToggleField,
  resolveSections,
  type FieldDef,
  type ListFieldDef,
  type MasterPageDef,
  type SectionDef,
} from "@/lib/master-pages";
import { areaPageDef, developmentPageDef } from "@/lib/master-pages/subpages";
import { MasterPageEditor } from "./_editor";

/**
 * Every master page and sub-page still renders its own editor.
 *
 * The field editor was lifted out of this file into
 * `app/[locale]/(admin)/admin/_fields/` so the page builder could share it. That move is
 * only safe if these sixteen master pages and the sub-page kinds still draw
 * exactly what they drew before — and the one editor test that existed rendered
 * a single sub-page, which is not enough to say so.
 *
 * This walks every registered page, renders the real editor, expands every
 * section in turn, and asserts each declared field produced a control inside
 * that section's panel.
 *
 * Two things it deliberately does NOT assert, because both are correct existing
 * behaviour rather than bugs:
 *
 *  - A list whose defaults already fill it to `max` shows no "Add" button
 *    (`items.length < field.max`). Seven such lists ship today — the Contact
 *    page's seven opening hours, About's two columns, several three-stat heroes.
 *  - A field label may repeat a section label ("Property types" on /buy is
 *    both), so rows are addressed by position and panels by structure, never by
 *    searching the page for a string.
 */

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const MEDIA = [
  { id: "m1", filename: "hero.jpg", url: "https://cdn.test/h.jpg", mime: "image/jpeg" },
  { id: "m2", filename: "brochure.pdf", url: "https://cdn.test/b.pdf", mime: "application/pdf" },
  { id: "m3", filename: "loop.mp4", url: "https://cdn.test/l.mp4", mime: "video/mp4" },
];

const SEEDS = {
  areas: {
    options: [{ name: "Saadiyat Island", href: "/areas/saadiyat", slug: "saadiyat" }],
    current: [{ name: "Saadiyat Island", href: "/areas/saadiyat", slug: "saadiyat" }],
  },
  developments: {
    options: [{ name: "Yas Point", href: "/developments/yas", slug: "yas" }],
    current: [{ name: "Yas Point", href: "/developments/yas", slug: "yas" }],
  },
  properties: {
    options: [{ name: "Villa · Saadiyat", href: "#", slug: "BZ-1001" }],
    current: [{ name: "Villa · Saadiyat", href: "#", slug: "BZ-1001" }],
  },
};

beforeAll(() => {
  window.matchMedia = ((q: string) => ({
    matches: false,
    media: q,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

function mount(def: MasterPageDef) {
  const sections = resolveSections(def, null);
  render(
    <MasterPageEditor
      pageKey={def.key}
      pageLabel={def.label}
      path={def.path}
      usingDefaults
      media={MEDIA}
      seeds={SEEDS}
      actions={{ save: vi.fn(), reset: vi.fn() }}
      initial={sections.map((s) => ({
        key: s.key,
        def: s.def,
        enabled: s.enabled,
        values: s.values,
      }))}
    />,
  );
  return sections;
}

/**
 * Section rows, in document order — which is `resolveSections` order.
 * Addressed by position rather than by label, because labels are not unique.
 */
function rows(): HTMLElement[] {
  return screen
    .getAllByRole("listitem")
    .filter((li) => within(li).queryByLabelText(/^(Expand|Collapse)$/));
}

/** Open a row and hand back its field panel. */
function openPanel(row: HTMLElement): HTMLElement {
  fireEvent.click(within(row).getByLabelText("Expand"));
  const panel = row.querySelector<HTMLElement>(":scope > div.border-t");
  expect(panel, "expanded row has no field panel").not.toBeNull();
  return panel!;
}

function closePanel(row: HTMLElement) {
  fireEvent.click(within(row).getByLabelText("Collapse"));
}

/** The control a field draws, asserted inside the panel only. */
function expectField(panel: HTMLElement, field: FieldDef) {
  const hits = within(panel).queryAllByText(field.label).length;
  if (isToggleField(field)) {
    // A hidden toggle renders "<label> — hidden", so match loosely.
    const loose = within(panel).queryAllByText(
      new RegExp(field.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    ).length;
    expect(hits + loose, `toggle "${field.label}"`).toBeGreaterThan(0);
    return;
  }
  expect(hits, `field "${field.label}"`).toBeGreaterThan(0);
}

describe.each(MASTER_PAGES.map((p) => [p.label, p] as const))(
  "master page: %s",
  (_label, def) => {
    it("lists every section the registry declares, in order", () => {
      const sections = mount(def);
      const found = rows();
      expect(found).toHaveLength(sections.length);
      sections.forEach((section, i) => {
        expect(
          within(found[i]).queryAllByText(section.def.label).length,
          `row ${i} should be "${section.def.label}"`,
        ).toBeGreaterThan(0);
      });
    });

    it("draws every field of every section when expanded", () => {
      const sections = mount(def);
      const found = rows();
      sections.forEach((section, i) => {
        if (section.def.fields.length === 0) return;
        const panel = openPanel(found[i]);
        for (const field of section.def.fields) expectField(panel, field);
        closePanel(found[i]);
      });
    });

    it("offers an add button for every list that isn't already full", () => {
      const sections = mount(def);
      const found = rows();
      sections.forEach((section, i) => {
        const lists = section.def.fields.filter(isListField);
        if (lists.length === 0) return;
        const panel = openPanel(found[i]);
        for (const list of lists) {
          const stored = section.values[list.key];
          const count = Array.isArray(stored) ? stored.length : 0;
          // A list shipped at its max deliberately shows no add button.
          if (count >= list.max) continue;
          const add = within(panel).queryAllByRole("button", {
            name: new RegExp(`add ${list.itemLabel}`, "i"),
          }).length;
          const seed = within(panel).queryAllByRole("button", {
            name: /load the/i,
          }).length;
          expect(
            add + seed,
            `list "${list.label}" (${count}/${list.max}) offers no way to add an item`,
          ).toBeGreaterThan(0);
        }
        closePanel(found[i]);
      });
    });
  },
);

describe("sub-pages", () => {
  const SUBPAGES: [string, MasterPageDef][] = [
    [
      "development",
      developmentPageDef({
        name: "The Canopies at Yas Point",
        slug: "the-canopies-at-yas-point-aldar",
      }) as MasterPageDef,
    ],
    [
      "area",
      areaPageDef({ name: "Saadiyat Island", slug: "saadiyat-island" }) as MasterPageDef,
    ],
  ];

  it.each(SUBPAGES)("%s sub-page draws every section and field", (_kind, def) => {
    const sections = mount(def);
    const found = rows();
    expect(found).toHaveLength(sections.length);
    sections.forEach((section, i) => {
      if (section.def.fields.length === 0) return;
      const panel = openPanel(found[i]);
      for (const field of section.def.fields) expectField(panel, field);
      closePanel(found[i]);
    });
  });

  it("keeps sub-page sections locked in the template's order", () => {
    // `allowReorder={false}` is what the sub-page routes pass; the anchor
    // sub-nav on the public page points at section ids in document order.
    const def = developmentPageDef({ name: "Yas Point", slug: "yas" }) as MasterPageDef;
    const sections = resolveSections(def, null);
    render(
      <MasterPageEditor
        pageKey="yas"
        pageLabel="Yas Point"
        path="/developments/yas"
        usingDefaults
        media={MEDIA}
        seeds={SEEDS}
        actions={{ save: vi.fn(), reset: vi.fn() }}
        allowReorder={false}
        initial={sections.map((s) => ({
          key: s.key,
          def: s.def,
          enabled: s.enabled,
          values: s.values,
        }))}
      />,
    );
    expect(screen.queryAllByLabelText(/^Reorder /)).toHaveLength(0);
  });
});

describe("the record-pick select", () => {
  /** Every select in the master pages is nested inside a list field. */
  function nestedSelects() {
    const out: {
      page: MasterPageDef;
      index: number;
      section: SectionDef;
      list: ListFieldDef;
      optionsKey: keyof typeof SEEDS;
    }[] = [];
    for (const page of MASTER_PAGES) {
      resolveSections(page, null).forEach((resolved, index) => {
        for (const field of resolved.def.fields) {
          if (!isListField(field)) continue;
          for (const sub of field.fields) {
            if (isSelectField(sub) && sub.optionsKey && sub.optionsKey in SEEDS) {
              out.push({
                page,
                index,
                section: resolved.def,
                list: field,
                optionsKey: sub.optionsKey as keyof typeof SEEDS,
              });
            }
          }
        }
      });
    }
    return out;
  }

  it("exists — otherwise this whole test is stale", () => {
    expect(nestedSelects().length).toBeGreaterThan(0);
  });

  it("still stores the record slug and shows the record name", () => {
    // The select arm gained a branch for code-declared `options`. Every master
    // page select uses `optionsKey`, so it must behave exactly as before:
    // option value = slug, option text = name.
    const target = nestedSelects()[0];
    mount(target.page);
    const panel = openPanel(rows()[target.index]);

    // The list ships empty, so seed a row to get at the select inside it.
    const seed = within(panel).queryAllByRole("button", { name: /load the/i })[0];
    const add = within(panel).queryAllByRole("button", {
      name: new RegExp(`add ${target.list.itemLabel}`, "i"),
    })[0];
    fireEvent.click(seed ?? add);

    const selects = within(panel).getAllByRole("combobox");
    const seeded = SEEDS[target.optionsKey];
    const match = selects
      .flatMap((s) => within(s).getAllByRole("option"))
      .find((o) => o.textContent === seeded.options[0].name);

    expect(match, `no option labelled "${seeded.options[0].name}"`).toBeTruthy();
    expect((match as HTMLOptionElement).value).toBe(seeded.options[0].slug);
  });
});
