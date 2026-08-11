/**
 * Field builders shared by every master-page section definition.
 *
 * These were private to `pages.ts` while the registry was one file. The five
 * marketing pages added in Sprint 14 keep their sections in their own modules
 * under `sections/`, so the builders live here where both can reach them.
 */
import type {
  ImageFieldDef,
  ToggleFieldDef,
  ListFieldDef,
  SimpleFieldDef,
  VideoFieldDef,
} from "./types";

export const text = (
  key: string,
  label: string,
  extra: Partial<SimpleFieldDef> = {},
): SimpleFieldDef => ({ key, label, kind: "text", max: 160, ...extra });

export const area = (
  key: string,
  label: string,
  extra: Partial<SimpleFieldDef> = {},
): SimpleFieldDef => ({
  key,
  label,
  kind: "textarea",
  max: 600,
  optional: true,
  ...extra,
});

export const link = (
  key: string,
  label: string,
  extra: Partial<SimpleFieldDef> = {},
): SimpleFieldDef => ({
  key,
  label,
  kind: "link",
  max: 240,
  optional: true,
  help: "Internal path (/buy/search) or full URL.",
  ...extra,
});

export const image = (key: string, label: string, help?: string): ImageFieldDef => ({
  key,
  label,
  kind: "image",
  help,
});

export const video = (key: string, label: string, help?: string): VideoFieldDef => ({
  key,
  label,
  kind: "video",
  help,
});

export const toggle = (
  key: string,
  label: string,
  help?: string,
): ToggleFieldDef => ({ key, label, kind: "toggle", help });

export const eyebrow = (extra: Partial<SimpleFieldDef> = {}) =>
  text("eyebrow", "Eyebrow", { max: 60, optional: true, ...extra });
export const heading = (extra: Partial<SimpleFieldDef> = {}) =>
  text("heading", "Heading", { ...extra });
export const body = (extra: Partial<SimpleFieldDef> = {}) =>
  area("body", "Body", { ...extra });
export const ctaPair = (labelDefault = "CTA label"): SimpleFieldDef[] => [
  text("cta_label", labelDefault, { max: 60, optional: true }),
  link("cta_href", "CTA link"),
];

export const faqList = (max = 12): ListFieldDef => ({
  key: "items",
  label: "Questions",
  kind: "list",
  itemLabel: "question",
  max,
  fields: [
    text("q", "Question", { max: 200 }),
    area("a", "Answer", { max: 1200, optional: false }),
  ],
});

export const tileList = (key: string, label: string, max = 8): ListFieldDef => ({
  key,
  label,
  kind: "list",
  itemLabel: "tile",
  max,
  fields: [
    text("name", "Title", { max: 80 }),
    area("desc", "Description", { max: 200 }),
    text("cta", "Link label", { max: 60, optional: true }),
    link("href", "Link"),
    image("image", "Image", "Falls back to the placeholder caption below."),
    text("img", "Placeholder caption", { max: 80, optional: true }),
  ],
});

export const chipList = (key: string, label: string, max = 24): ListFieldDef => ({
  key,
  label,
  kind: "list",
  itemLabel: "chip",
  max,
  fields: [
    text("label", "Label", { max: 60 }),
    link("href", "Link"),
  ],
});

export const statList = (max = 4): ListFieldDef => ({
  key: "stats",
  label: "Stats",
  kind: "list",
  itemLabel: "stat",
  max,
  fields: [
    text("value", "Value", { max: 40 }),
    text("label", "Caption", { max: 60 }),
  ],
});

/**
 * A grid of value cards — the shape both service landings use for their
 * "what we do" sections. Every card carries its own visibility toggle, so an
 * editor can drop one for a season without deleting the copy and retyping it
 * later.
 */
export const cardList = (
  key: string,
  label: string,
  opts: {
    itemLabel?: string;
    max?: number;
    help?: string;
    descMax?: number;
    /** Adds an image picker + placeholder caption to every card. */
    withImage?: boolean;
    /** Adds a CTA label + link to every card. */
    withLink?: boolean;
  } = {},
): ListFieldDef => ({
  key,
  label,
  kind: "list",
  itemLabel: opts.itemLabel ?? "card",
  max: opts.max ?? 8,
  help: opts.help,
  fields: [
    toggle("enabled", "Show this card"),
    text("name", "Title", { max: 80 }),
    area("desc", "Description", { max: opts.descMax ?? 240, optional: false }),
    ...(opts.withLink
      ? [
          text("cta", "Link label", { max: 60, optional: true }),
          link("href", "Link"),
        ]
      : []),
    ...(opts.withImage
      ? [
          image("image", "Image", "Falls back to the placeholder caption below."),
          text("img", "Placeholder caption", { max: 80, optional: true }),
        ]
      : []),
  ],
});

export const propTypeList = (
  max = 8,
  opts: { withImage?: boolean } = {},
): ListFieldDef => ({
  key: "items",
  label: "Property types",
  kind: "list",
  itemLabel: "type",
  max,
  fields: [
    text("name", "Name", { max: 80 }),
    area("desc", "Description", { max: 240 }),
    text("cta", "Link label", { max: 60, optional: true }),
    link("href", "Link"),
    ...(opts.withImage
      ? [
          image("image", "Image", "Falls back to the placeholder caption."),
          text("img", "Placeholder caption", { max: 80, optional: true }),
        ]
      : []),
  ],
});
