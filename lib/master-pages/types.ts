/**
 * Master-page section model.
 *
 * The four marketing master pages (home, buy, rent, off-plan) are bespoke
 * compositions, not generic page-builder blocks — so instead of replacing them
 * with `pages.blocks` hero/strip/split primitives, each *section* of each page
 * is declared here with the fields an editor may change. The page components
 * keep their design; only their content comes from the database.
 *
 * A section definition carries its own defaults, which are the copy currently
 * hardcoded in the page. That means:
 *  - nothing changes visually until someone edits a field;
 *  - a section added in code shows up in the editor automatically;
 *  - "revert to default" is always available, per field or per section.
 */

export type SimpleFieldKind = "text" | "textarea" | "link";

export type SimpleFieldDef = {
  key: string;
  label: string;
  kind: SimpleFieldKind;
  help?: string;
  /** Max length; also drives the editor's counter. */
  max?: number;
  /** Blank allowed. Defaults to true for everything but `text`. */
  optional?: boolean;
};

export type ImageFieldDef = {
  key: string;
  label: string;
  kind: "image";
  help?: string;
};

export type ListFieldDef = {
  key: string;
  label: string;
  kind: "list";
  help?: string;
  /** Singular noun for the add button — "tile", "question", "community". */
  itemLabel: string;
  max: number;
  fields: (SimpleFieldDef | ImageFieldDef)[];
};

export type FieldDef = SimpleFieldDef | ImageFieldDef | ListFieldDef;

/** A picked media asset. `media_id` null ⇒ fall back to the placeholder art. */
export type ImageValue = {
  media_id: string | null;
  alt: string | null;
  /** Placeholder caption used when no asset is picked. */
  label: string | null;
  /**
   * Public URL, resolved server-side from `media_id` when the content is
   * loaded. Never stored — `media_id` is the source of truth, so moving the
   * asset or renaming the file doesn't break the page.
   */
  url?: string | null;
};

export type FieldValue =
  | string
  | null
  | ImageValue
  | Record<string, string | null | ImageValue>[];

export type SectionValues = Record<string, FieldValue>;

export type SectionDef = {
  key: string;
  label: string;
  /** One line describing what the section is, shown in the editor. */
  description: string;
  fields: FieldDef[];
  defaults: SectionValues;
  /**
   * Sections that can't be hidden or moved — the hero, and anything the page
   * is structurally built around.
   */
  locked?: boolean;
  /**
   * Content the section pulls from elsewhere (listings, developments, areas),
   * named so the editor can say what is *not* editable here.
   */
  dataNote?: string;
};

export type MasterPageKey = "home" | "buy" | "rent" | "off-plan";

export type MasterPageDef = {
  key: MasterPageKey;
  label: string;
  /** Public path, for the "View page" link. */
  path: string;
  description: string;
  sections: SectionDef[];
};

/** One section as stored in the database. */
export type StoredSection = {
  key: string;
  enabled: boolean;
  values: SectionValues;
};

/** A section resolved for rendering: definition + effective values. */
export type ResolvedSection = {
  key: string;
  def: SectionDef;
  enabled: boolean;
  values: SectionValues;
};

export function isImageField(f: FieldDef): f is ImageFieldDef {
  return f.kind === "image";
}

export function isListField(f: FieldDef): f is ListFieldDef {
  return f.kind === "list";
}

export function emptyImage(label: string | null = null): ImageValue {
  return { media_id: null, alt: null, label };
}
