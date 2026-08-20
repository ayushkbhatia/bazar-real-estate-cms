import { z } from "zod";
import { uuidLike } from "@/lib/uuid";

/**
 * Schemas + shaped types for the CMS-editable footer.
 *
 *   settings (1 row)  →  blurb, contact heading, legal line
 *   columns           →  links (kind = links | legal)
 *   socials           →  the pill row under the wordmark
 *   contact items     →  the labelled entries in the Contact column
 *
 * `components/brand/public-footer.tsx` consumes `FooterContent` (the shaped
 * tree) from `lib/queries/footer.ts`. The admin editor validates against the
 * *EditInput schemas before the payload reaches
 * `app/[locale]/(admin)/admin/footer/_actions.ts`.
 *
 * Modelled on `lib/schemas/megamenu.ts`, including the one rule there that is
 * easy to read past: **Arabic twins are `.nullable()` and NOT `.optional()`.**
 * The save is a delete-and-reinsert, so a twin the editor forgets to send is
 * not a field left alone — it is a field destroyed, in a language most people
 * reviewing the save cannot proofread. Required-with-null turns that into a
 * validation error instead. Caps are 1.5× their English sibling, matching
 * `arMax` in `lib/master-pages/twins.ts`.
 */

// ───────────────────────────────────────────────────────────────
// Enums — mirror the Postgres enums in 0112.
// ───────────────────────────────────────────────────────────────
export const FOOTER_COLUMN_KINDS = ["links", "legal"] as const;
export type FooterColumnKind = (typeof FOOTER_COLUMN_KINDS)[number];

export const FOOTER_CONTACT_KINDS = [
  "phone",
  "email",
  "address",
  "text",
] as const;
export type FooterContactKind = (typeof FOOTER_CONTACT_KINDS)[number];

export const FOOTER_CONTACT_KIND_LABELS: Record<FooterContactKind, string> = {
  phone: "Phone — each line becomes a tel: link",
  email: "Email — each line becomes a mailto: link",
  address: "Address — plain lines, no link",
  text: "Free text — plain lines, no link",
};

// ───────────────────────────────────────────────────────────────
// Shaped read types — what the renderer consumes.
// ───────────────────────────────────────────────────────────────
/* Twins are optional on the READ types so a caller that has not been taught to
 * select them still typechecks; the renderer never reads them, because
 * `localiseDeep` has already stripped every `_ar` key by then. */
export type FooterLink = {
  id: string;
  position: number;
  label: string;
  href: string;
  label_ar?: string | null;
};

export type FooterColumn = {
  id: string;
  kind: FooterColumnKind;
  position: number;
  heading: string | null;
  is_visible: boolean;
  heading_ar?: string | null;
  links: FooterLink[];
};

export type FooterSocial = {
  id: string;
  position: number;
  /** The network's own name. No twin — a wordmark, not prose. */
  label: string;
  href: string;
  is_visible: boolean;
};

export type FooterContactItem = {
  id: string;
  position: number;
  kind: FooterContactKind;
  label: string;
  /** One value per line. */
  body: string;
  is_visible: boolean;
  label_ar?: string | null;
  body_ar?: string | null;
};

export type FooterSettings = {
  blurb: string | null;
  contact_heading: string | null;
  legal_line: string | null;
  blurb_ar?: string | null;
  contact_heading_ar?: string | null;
  legal_line_ar?: string | null;
};

export type FooterContent = {
  settings: FooterSettings;
  /** kind = 'links', ordered. These are the grid columns. */
  columns: FooterColumn[];
  /** kind = 'legal', flattened — the bottom bar is one row of links. */
  legal: FooterLink[];
  socials: FooterSocial[];
  contact: FooterContactItem[];
};

// ───────────────────────────────────────────────────────────────
// Write schemas
// ───────────────────────────────────────────────────────────────
export const footerSettingsEditSchema = z.object({
  blurb: z.string().max(400).nullable(),
  blurb_ar: z.string().max(600).nullable(),
  contact_heading: z.string().max(60).nullable(),
  contact_heading_ar: z.string().max(90).nullable(),
  legal_line: z.string().max(300).nullable(),
  legal_line_ar: z.string().max(450).nullable(),
});
export type FooterSettingsEditInput = z.infer<typeof footerSettingsEditSchema>;

export const footerLinkEditSchema = z.object({
  id: uuidLike().optional(),
  position: z.number().int().min(0),
  label: z.string().min(1).max(120),
  label_ar: z.string().max(180).nullable(),
  href: z.string().min(1).max(240),
});
export type FooterLinkEditInput = z.infer<typeof footerLinkEditSchema>;

export const footerColumnEditSchema = z.object({
  id: uuidLike().optional(),
  kind: z.enum(FOOTER_COLUMN_KINDS),
  position: z.number().int().min(0),
  heading: z.string().max(80).nullable(),
  heading_ar: z.string().max(120).nullable(),
  is_visible: z.boolean(),
  links: z.array(footerLinkEditSchema).min(0).max(30),
});
export type FooterColumnEditInput = z.infer<typeof footerColumnEditSchema>;

export const footerSocialEditSchema = z.object({
  id: uuidLike().optional(),
  position: z.number().int().min(0),
  label: z.string().min(1).max(40),
  href: z.string().min(1).max(240),
  is_visible: z.boolean(),
});
export type FooterSocialEditInput = z.infer<typeof footerSocialEditSchema>;

export const footerContactItemEditSchema = z.object({
  id: uuidLike().optional(),
  position: z.number().int().min(0),
  kind: z.enum(FOOTER_CONTACT_KINDS),
  label: z.string().min(1).max(60),
  label_ar: z.string().max(90).nullable(),
  body: z.string().min(1).max(400),
  body_ar: z.string().max(600).nullable(),
  is_visible: z.boolean(),
});
export type FooterContactItemEditInput = z.infer<
  typeof footerContactItemEditSchema
>;

/**
 * The whole footer, saved in one go.
 *
 * One payload rather than five endpoints for the same reason the megamenu has
 * one: the editor holds the entire surface in local state, so a partial save
 * would let the screen and the database disagree about a footer the visitor
 * sees as a single object.
 *
 * The 8-column cap is not arbitrary. `PublicFooter` lays out
 * `[brand][…columns][contact]` in one grid row, and past eight the columns
 * stop being readable before they stop fitting.
 */
export const footerEditPayloadSchema = z.object({
  settings: footerSettingsEditSchema,
  columns: z.array(footerColumnEditSchema).min(0).max(8),
  socials: z.array(footerSocialEditSchema).min(0).max(12),
  contact: z.array(footerContactItemEditSchema).min(0).max(10),
});
export type FooterEditPayload = z.infer<typeof footerEditPayloadSchema>;

// ───────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────
export function defaultNewFooterLink(position: number): FooterLinkEditInput {
  return { position, label: "New link", label_ar: null, href: "/" };
}

export function defaultNewFooterColumn(
  position: number,
  kind: FooterColumnKind = "links",
): FooterColumnEditInput {
  return {
    kind,
    position,
    heading: kind === "links" ? "New column" : null,
    heading_ar: null,
    is_visible: true,
    links: [defaultNewFooterLink(0)],
  };
}

export function defaultNewFooterSocial(
  position: number,
): FooterSocialEditInput {
  return { position, label: "Network", href: "https://", is_visible: true };
}

export function defaultNewFooterContactItem(
  position: number,
): FooterContactItemEditInput {
  return {
    position,
    kind: "text",
    label: "New entry",
    label_ar: null,
    body: "Value",
    body_ar: null,
    is_visible: true,
  };
}
