/**
 * A block-built newsletter: a page of email blocks (a hero, a heading, a row
 * of features, an "at a glance" table…), each with its own fields, colours
 * and images, stored as one JSON document on the campaign
 * (`newsletter_campaigns.design`, 0175) or on a saved template
 * (`newsletter_templates.design`). See docs/NEWSLETTER.md, "Block-built
 * newsletters".
 *
 * ONE DOCUMENT, BOTH EDITIONS. A translatable field's Arabic sits beside it
 * under `<key>_ar` — in a block's props and in each repeated item — the way a
 * page section stores its Arabic (docs/I18N.md). Images, colours and links
 * are one design in both languages; the Arabic edition is drawn right to left.
 *
 * Pure types — imported by the designer on the client.
 */

import type { FeatureKind, FeatureLayout } from "@/lib/content-assets/email-feature";

/** An image chosen from (or uploaded to) the media library. */
export type ImageValue = {
  url: string;
  /** Media-library storage key: rebuilt into a URL at render time, so a project move doesn't break it. */
  key?: string | null;
  alt?: string;
};

/** The featured-records block's stored value: ids, never words. */
export type RecordsValue = {
  kind: FeatureKind;
  ids: string[];
  labels: string[];
  layout: FeatureLayout;
};

export type Props = Record<string, unknown>;

export type Block = { id: string; type: string; props: Props };

export const FONT_CHOICES = ["serif", "sans"] as const;
export type FontChoice = (typeof FONT_CHOICES)[number];

/** The page every block sits on. */
export type DesignSettings = {
  /** Behind the 600px column (what a wide inbox shows either side). */
  pageBackground: string;
  /** The column itself, where a block has no background of its own. */
  contentBackground: string;
  textColor: string;
  headingColor: string;
  mutedColor: string;
  linkColor: string;
  /** Default button fill and text. A block can set its own. */
  buttonColor: string;
  buttonTextColor: string;
  headingFont: FontChoice;
  bodyFont: FontChoice;
};

export type Design = { version: 1; settings: DesignSettings; blocks: Block[] };

type Base = { key: string; label: string; help?: string };

export type ScalarFieldDef =
  | (Base & { kind: "text"; placeholder?: string; max?: number; translatable?: boolean })
  | (Base & { kind: "textarea"; placeholder?: string; max?: number; translatable?: boolean })
  | (Base & { kind: "url"; placeholder?: string })
  | (Base & { kind: "color"; allowBlank?: boolean })
  | (Base & { kind: "image" })
  | (Base & { kind: "select"; options: readonly { value: string; label: string }[] })
  | (Base & { kind: "number"; min: number; max: number; step?: number; unit?: string })
  | (Base & { kind: "toggle" });

export type FieldDef =
  | ScalarFieldDef
  | (Base & {
      kind: "items";
      /** "Feature", "Row" — what one item is called in the editor. */
      itemLabel: string;
      min: number;
      max: number;
      fields: ScalarFieldDef[];
    })
  | (Base & { kind: "records" });

export const BLOCK_CATEGORIES = [
  "Headers",
  "Text",
  "Images",
  "Columns",
  "Lists & details",
  "Calls to action",
  "From the site",
  "Footer",
  "Spacing",
] as const;
export type BlockCategory = (typeof BLOCK_CATEGORIES)[number];

export type BlockDef = {
  type: string;
  label: string;
  category: BlockCategory;
  description: string;
  fields: FieldDef[];
  defaults: Props;
};

/** A ready-made variant of a block: its props laid over the block's defaults. */
export type BlockPreset = {
  id: string;
  type: string;
  label: string;
  description: string;
  props: Props;
};
