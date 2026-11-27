/**
 * "Local Expertise" — the communities Bazar advises on most, as a band of area
 * cards. Placed on the home page (above the List-your-property form) and on
 * /areas (after the area cards), each page with its own copy of the section,
 * the way the partner band is shared (`partner-band.ts`): a section is a piece
 * of a page, so the two pages share a starting point, not a row.
 *
 * A card is an AREA, picked from the live areas table. Everything else on it
 * is optional and falls back to that area's record: its name (folded into
 * Arabic on /ar), its guide page, and the hero photo its guide leads with. So
 * the shipped list is seven slugs and nothing else to keep in step, and a
 * renamed area or a new hero photo shows here without anyone touching the
 * section.
 *
 * The seven are the client's list, in their order: first asked for on 24 Nov
 * 2026, rearranged on 27 Nov (Zayed City and Al Shamkha out, Al Bahia and
 * Al Falah in). Every one already existed as an area; none was created for
 * this. "Nureel Island" in the request is Nareel Island, the villa island off
 * Al Bateen.
 */
import type { SectionDef, SectionValues } from "../types";
import { text, link, image, toggle, eyebrow, heading, body, ctaPair } from "../fields";

/**
 * The client's seven, in their order. The first is the large tile; the grid
 * beside it fills row by row, so the next three are its top row and the last
 * three its bottom row.
 */
export const EXPERTISE_AREA_SLUGS = [
  "nareel-island",
  // Top row
  "mohammed-bin-zayed-city",
  "shakhbout-city",
  "al-bateen",
  // Bottom row
  "al-bahia",
  "al-falah",
  "khalifa-city",
] as const;

const cards = (): SectionValues["cards"] =>
  EXPERTISE_AREA_SLUGS.map((slug) => ({
    enabled: true,
    slug,
    name: null,
    subtitle: null,
    href: null,
    image: { media_id: null, alt: null, label: null },
  }));

/**
 * The copy both pages start from. The Arabic is declared beside its English
 * (docs/I18N.md, "Defaults need an entry in the Arabic store" — the third
 * option), so /ar reads Arabic before anyone has opened the editor.
 */
const COPY: SectionValues = {
  eyebrow: "Abu Dhabi communities",
  eyebrow_ar: "مجتمعات أبوظبي",
  heading: "Local Expertise",
  heading_ar: "خبرتنا المحلية",
  body: "The communities our advisors know best — from the island launches to the capital's established family districts.",
  body_ar:
    "المجتمعات التي يعرفها مستشارونا عن قرب، من مشاريع الجزر الجديدة إلى أحياء العاصمة العائلية الراسخة.",
};

export function expertiseAreasSection(opts: {
  placeAfter: string;
  /** The link beside the heading. Null hides it (on /areas it would point at itself). */
  cta: { label: string; labelAr: string; href: string } | null;
}): SectionDef {
  return {
    key: "expertise_areas",
    label: "Local Expertise",
    description:
      "A large tile and a grid of area cards for the communities Bazar knows best.",
    dataNote:
      "Pick each card's area; the rest is optional. A blank title uses the area's own name (in Arabic on the Arabic site), a blank link opens its area page, and a blank image uses the photo that page leads with. The first card is the large tile. A blank subtitle reads \"Explore Homes\"; write your own with {count} where the area's live listing count goes.",
    dataLink: { label: "Edit the areas", href: "/admin/pages/sub/area" },
    placeAfter: opts.placeAfter,
    fields: [
      eyebrow(),
      heading(),
      body(),
      ...ctaPair("Link beside the heading"),
      {
        key: "cards",
        label: "Area cards",
        kind: "list",
        itemLabel: "card",
        max: 9,
        help: "The first card is the large tile. Switch a card off to hide it without deleting it.",
        fields: [
          toggle("enabled", "Show this card"),
          {
            key: "slug",
            label: "Area",
            kind: "select",
            optionsKey: "areas",
            placeholder: "Choose an area",
          },
          text("name", "Title", {
            max: 80,
            optional: true,
            help: "Blank uses the area's own name.",
          }),
          // The line under the title. `{count}` is the area's live count.
          text("subtitle", "Subtitle · {count} is the live number", {
            max: 60,
            optional: true,
            placeholder: "Explore Homes",
            placeholderAr: "استكشف المنازل",
          }),
          link("href", "Link", { help: "Blank opens the area's own page." }),
          image("image", "Image", "Blank uses the area page's hero photo."),
        ],
      },
    ],
    defaults: {
      ...COPY,
      cta_label: opts.cta?.label ?? null,
      cta_label_ar: opts.cta?.labelAr ?? null,
      cta_href: opts.cta?.href ?? null,
      cards: cards(),
    },
  };
}
