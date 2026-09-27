import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";

/*
 * The card is an async Server Component: it awaits its translations and the
 * card-label vocabulary, then returns markup. Everything it reaches for is
 * stubbed here to something deterministic, so what is under test is the card's
 * own layout and nothing it borrows.
 */
vi.mock("next-intl/server", () => ({
  getTranslations: async () => (key: string, args?: Record<string, string>) =>
    args ? `${key}(${Object.values(args).join(" ")})` : key,
}));
vi.mock("@/lib/queries/card-labels", () => ({
  getCardLabelResolver: async () => ({ labels }: { labels: string[] }) =>
    labels.map((id) => ({ id, label: `label ${id}`, kind: "accent" })),
}));
vi.mock("@/components/i18n/link", () => ({
  default: ({ href, className, children }: Record<string, never>) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt, sizes, loading, fetchPriority, className }: Record<string, string>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      data-sizes={sizes}
      data-loading={loading}
      data-fetch-priority={fetchPriority}
      className={className}
    />
  ),
}));
vi.mock("../area-text", () => ({
  PriceText: ({ aed }: { aed: number | null }) => <>{`price ${aed}`}</>,
}));
vi.mock("@/lib/media", () => ({
  mediaPublicUrl: (key: string) => `https://media.test/${key}`,
}));

const { DevelopmentCard } = await import("./development-card");

type Props = Parameters<typeof DevelopmentCard>[0];

const PROJECT: Props["d"] = {
  id: "dev-1",
  name: "Yas Park Place",
  slug: "yas-park-place",
  status: "on_sale",
  handover_date: "2030-02-01",
  total_units: 400,
  starting_price: 1_400_000,
  tagline: "Apartments on Yas Island",
  card_labels: ["new", "exclusive", "hot"],
  bedrooms_text: "Studios, 1 - 3",
  description: null,
  developer: { name: "Aldar", slug: "aldar" },
  area: { name: "Yas Island", slug: "yas-island" },
  hero: { storage_key: "yas.jpg", alt_text: "Yas Park Place render" } as Props["d"]["hero"],
};

async function mount(props: Partial<Props> = {}) {
  const element = (await DevelopmentCard({ d: PROJECT, ...props })) as ReactElement;
  return render(element);
}

/** The element whose class list carries a given label's layout. */
const statOf = (label: string) => screen.getByText(label).parentElement!;

describe("DevelopmentCard — one to a row on a phone (the default)", () => {
  it("links the whole card to the project page", async () => {
    await mount();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/developments/yas-park-place",
    );
  });

  it("shows all three facts in a three-column row at every width", async () => {
    await mount();
    const row = statOf("from").parentElement!;
    expect(row.className).toContain("grid-cols-3");
    expect(row.className).not.toMatch(/(^|\s)grid-cols-1/);
    expect(statOf("bedrooms").className).not.toContain("hidden");
  });

  it("keeps the image lazy and sized for a rail or a three-up grid", async () => {
    await mount();
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("data-sizes", "(max-width: 1024px) 100vw, 33vw");
    expect(img).not.toHaveAttribute("data-loading");
    expect(img).not.toHaveAttribute("data-fetch-priority");
  });

  it("lets each value follow the page's direction and isolate its own", async () => {
    // `:lang(ar) .mono` forces `direction: ltr`. Left to it, every value on
    // /ar sat at the far edge from its label and a price read figure-last.
    await mount();
    for (const label of ["from", "bedrooms", "handoverLabel"]) {
      const value = statOf(label).lastElementChild as HTMLElement;
      expect(value.className).toContain("mono");
      expect(value.style.direction, label).toBe("inherit");
      expect(value.firstElementChild?.tagName, label).toBe("BDI");
    }
  });

  it("draws every label and the tagline, unclamped", async () => {
    await mount();
    for (const text of ["label new", "label exclusive", "label hot", "Apartments on Yas Island"]) {
      expect(screen.getByText(text).className).toContain("inline-flex");
    }
  });
});

describe("DevelopmentCard — two to a row on a phone", () => {
  it("drops to a single column of facts below `sm`, so no track is phone-narrow", async () => {
    // e2e/mobile-geometry.spec.ts fails any grid track under 60px at 390px.
    // Three facts across a ~170px card would be ~40px each.
    await mount({ phoneColumns: 2 });
    const row = statOf("from").parentElement!;
    expect(row.className).toMatch(/(^|\s)grid-cols-1(\s|$)/);
    expect(row.className).toContain("sm:grid-cols-3");
  });

  it("leaves bedrooms to the project page on a phone and restores it from `sm`", async () => {
    await mount({ phoneColumns: 2 });
    expect(statOf("bedrooms").className).toContain("max-sm:hidden");
    expect(statOf("from").className).not.toContain("hidden");
    expect(statOf("handoverLabel").className).not.toContain("hidden");
  });

  it("fills its grid cell, so the facts line up along a row of cards", async () => {
    await mount({ phoneColumns: 2 });
    expect(screen.getByRole("link").className).toMatch(/(^|\s)h-full(\s|$)/);
  });

  it("clamps the chips to one line and shows only two of them on a phone", async () => {
    await mount({ phoneColumns: 2 });
    const chips = ["label new", "label exclusive", "label hot", "Apartments on Yas Island"].map(
      (text) => screen.getByText(text),
    );
    // The text sits in a clamped span inside the pill; a wrapped pill would
    // cover the render on a 170px card.
    for (const text of chips) expect(text.className).toContain("line-clamp-1");
    const pills = chips.map((text) => text.parentElement!);
    expect(pills[0].className).not.toContain("max-sm:hidden");
    expect(pills[1].className).not.toContain("max-sm:hidden");
    expect(pills[2].className).toContain("max-sm:hidden");
    expect(pills[3].className).toContain("max-sm:hidden");
  });

  it("passes the page's own sizes hint and loads eagerly when asked", async () => {
    await mount({ phoneColumns: 2, sizes: "50vw", eager: true });
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("data-sizes", "50vw");
    expect(img).toHaveAttribute("data-loading", "eager");
    expect(img).toHaveAttribute("data-fetch-priority", "high");
  });
});
