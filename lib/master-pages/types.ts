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

/**
 * A pick from live records — a development, an area — rather than free text.
 * Options come from the same `seeds` the admin route already supplies, and the
 * stored value is the record's slug, so a rename doesn't break the link.
 */
export type SelectFieldDef = {
  key: string;
  label: string;
  kind: "select";
  optionsKey: SeedKey;
  help?: string;
  /** Placeholder for the empty option. */
  placeholder?: string;
};

export type ToggleFieldDef = {
  key: string;
  label: string;
  kind: "toggle";
  help?: string;
};

export type ImageFieldDef = {
  key: string;
  label: string;
  kind: "image";
  help?: string;
};

/**
 * A document picked from the media library — a brochure PDF, say.
 *
 * Its stored value is an `ImageValue`, deliberately: the reference is a
 * `media_id` either way, so `attachImageUrls` resolves the public URL for a
 * file field without knowing it exists. The kinds differ only in what the
 * picker offers and what the page does with the result.
 */
export type FileFieldDef = {
  key: string;
  label: string;
  kind: "file";
  help?: string;
  /** MIME prefix the picker filters on. Defaults to application/pdf. */
  accept?: string;
};

/**
 * A video picked from the media library — the home hero background.
 *
 * Stores an `ImageValue` like the image and file kinds, so `attachImageUrls`
 * resolves its public URL without special-casing. It is a distinct kind rather
 * than a `file` with `accept: "video/"` because it uploads over a different
 * transport: video bypasses the server action (and its 12 MB body limit) and
 * goes browser → Storage on a signed URL. See lib/media.ts.
 */
export type VideoFieldDef = {
  key: string;
  label: string;
  kind: "video";
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
  fields: (
    | SimpleFieldDef
    | ImageFieldDef
    | FileFieldDef
    | ToggleFieldDef
    | SelectFieldDef
  )[];
  /**
   * Live data this list mirrors. When the stored list is empty the editor
   * offers to seed it from the current records (areas, say) so an editor can
   * switch individual cards off without hand-typing the whole set.
   */
  seedKey?: SeedKey;
};

export type SeedKey = "areas" | "developments" | "properties";

export type FieldDef =
  | SimpleFieldDef
  | ImageFieldDef
  | FileFieldDef
  | VideoFieldDef
  | ToggleFieldDef
  | SelectFieldDef
  | ListFieldDef;

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
  /**
   * Resolved alongside `url`, and never stored either. Only the video field
   * needs it, to give <source> a correct `type` instead of guessing from the
   * file extension.
   */
  mime?: string | null;
};

export type ItemValue = string | boolean | null | ImageValue;

export type FieldValue =
  | string
  | boolean
  | null
  | ImageValue
  | Record<string, ItemValue>[];

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
   * Whether the section is on for a page nobody has edited yet. Defaults to
   * true — a section declared in code shows up. Set false for one the page
   * keeps but doesn't lead with: the editor still sees it, with its copy and
   * its defaults intact, and can switch it back on.
   */
  defaultEnabled?: boolean;
  /**
   * Content the section pulls from elsewhere (listings, developments, areas),
   * named so the editor can say what is *not* editable here.
   */
  dataNote?: string;
};

export type MasterPageKey =
  | "home"
  | "buy"
  | "rent"
  | "commercial"
  | "off-plan"
  | "areas"
  | "developers"
  | "services"
  | "insights"
  | "about"
  | "contact"
  | "sell"
  | "qr"
  | "contact-qr";

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

export function isFileField(f: FieldDef): f is FileFieldDef {
  return f.kind === "file";
}

export function isVideoField(f: FieldDef): f is VideoFieldDef {
  return f.kind === "video";
}

/** All three store a media reference, so all three need URL resolution. */
export function isMediaField(
  f: FieldDef,
): f is ImageFieldDef | FileFieldDef | VideoFieldDef {
  return f.kind === "image" || f.kind === "file" || f.kind === "video";
}

export function isListField(f: FieldDef): f is ListFieldDef {
  return f.kind === "list";
}

export function isToggleField(f: FieldDef): f is ToggleFieldDef {
  return f.kind === "toggle";
}

export function isSelectField(f: FieldDef): f is SelectFieldDef {
  return f.kind === "select";
}

export function emptyImage(label: string | null = null): ImageValue {
  return { media_id: null, alt: null, label };
}
