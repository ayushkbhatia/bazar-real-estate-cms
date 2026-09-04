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
  /**
   * Opt this field OUT of its Arabic twin.
   *
   * Default is ON for `text` and `textarea`, and that default is deliberate:
   * a forgotten opt-out costs one unused input in the editor, while a
   * forgotten opt-in costs a permanent hole on the Arabic site that nobody
   * finds until a customer does.
   *
   * Set `false` for anything that is not prose — a stat value ("2,400"), a
   * unit ("AED/ft²"), a lucide icon name, a social network name, a CSS
   * alignment token. `link` fields are never translatable.
   */
  i18n?: false;
  /**
   * Max length for the Arabic twin. Defaults to 1.5x `max`, because Arabic
   * runs longer than English for the same content often enough that reusing
   * the English cap silently truncates real copy.
   */
  maxAr?: number;
};

/**
 * A pick from a fixed set. Two flavours, and exactly one of the two option
 * sources is set:
 *
 *  - `optionsKey` — live records (a development, an area, a form). Options come
 *    from the same `seeds` the admin route already supplies, and the stored
 *    value is the record's slug or key, so a rename doesn't break the link. The
 *    value is *not* validated on save: a record can be unpublished after the
 *    fact, and the renderer already drops picks it can't resolve.
 *  - `options` — choices declared in code: column counts, aspect ratios, banner
 *    variants. These *are* validated on save, because the set is closed and the
 *    renderer switches on the value.
 */
export type SelectFieldDef = {
  key: string;
  label: string;
  kind: "select";
  optionsKey?: SeedKey;
  options?: { value: string; label: string }[];
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
  /**
   * Offer a second picker for the Arabic rendering of this image.
   *
   * Opt-in per field rather than on by default. Most images on the site are
   * photography — a skyline, a lobby, a coastline — and carry no language, so
   * a second picker under every one of them would be a hundred pieces of
   * furniture nobody uses. The ones that need it are the images with English
   * *inside* them: the "List your property" card, where the artwork itself is
   * typeset copy that stays English under `lang="ar"`.
   *
   * The picked asset is stored as `media_id_ar` inside the same `ImageValue`,
   * beside `alt_ar` — the twin lives next to its sibling at whatever depth the
   * sibling lives, same rule as everywhere else. `applyLocale` swaps it in
   * before `attachImageUrls` resolves the URL, so no renderer changes.
   */
  arabicVariant?: boolean;
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

export type SeedKey = "areas" | "developments" | "properties" | "forms";

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
  /**
   * Arabic alt text. Sits beside `alt` rather than in a parallel structure,
   * per the one rule: the twin lives next to its sibling at whatever depth the
   * sibling lives. Optional because `normaliseScalar` has to tolerate stored
   * values written before this existed.
   */
  alt_ar?: string | null;
  /**
   * The asset to render instead of `media_id` under Arabic — an image whose
   * artwork is typeset English, redrawn in Arabic. Blank keeps the English
   * asset, exactly as a blank `alt_ar` keeps the English alt text.
   *
   * Only surfaced in the editor for a field declaring `arabicVariant`, but
   * stored, validated and folded generically, so turning the flag on for
   * another image is a one-word change.
   */
  media_id_ar?: string | null;
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
  // Its sibling index, and the last public marketing page that was still
  // entirely literals — see lib/master-pages/sections/partners.ts.
  | "partners"
  | "services"
  | "insights"
  | "about"
  | "contact"
  | "sell"
  | "manage"
  | "consultation"
  | "qr"
  | "contact-qr"
  | "mortgage"
  // The three legal documents, all of them hardcoded JSX until they were not.
  // Privacy was held back on the reasoning that a verbatim transcription of a
  // signed bilingual PDF gives an editor nothing to change. That was wrong in
  // the ordinary case: the policy names a CRM the client may swap, a mailbox,
  // an office address and a "Last updated" date, and every one of those
  // changes without a lawyer being involved.
  | "legal-privacy"
  | "legal-terms"
  | "legal-cookies";

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
