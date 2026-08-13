/**
 * Forms Manager — the model behind /admin/forms.
 *
 * Every lead-capture form on the public site is declared once, in
 * `lib/forms/registry.ts`, with the fields it renders today. That registry is
 * authoritative for *what exists*; the database is authoritative for *what an
 * editor changed*. The two are merged at read time (`resolveForm`), which is
 * the same contract `lib/master-pages` uses for section content and gives the
 * same three properties:
 *
 *   - nothing changes visually until someone edits a field;
 *   - a form added in code shows up in the manager automatically;
 *   - a missing table, an unapplied migration or a dead database renders the
 *     form exactly as it rendered before any of this existed.
 *
 * The split against Pages & blocks is deliberate. A section's *heading* is page
 * copy and stays in the master-page editor — `headingSource` records where, so
 * the manager can link to it rather than offer a second field that writes to a
 * different row. What the manager owns is the form itself: whether it shows,
 * its fields and their order, its button, and its confirmation.
 */

import type { ENQUIRY_SOURCES } from "@/lib/schemas/enquiry";
import type { MasterPageKey } from "@/lib/master-pages/types";

export type EnquirySource = (typeof ENQUIRY_SOURCES)[number];

/**
 * What an input *is*, from an editor's point of view. Deliberately smaller
 * than the HTML input set: a "date of birth" picker and a file upload are
 * features, not type changes, and adding one is a code change so the server
 * knows what to do with the value.
 *
 *   text        single-line free text
 *   email       single-line, validated as an address
 *   tel         single-line phone, loose validation (international numbers vary)
 *   phone_dial  dial-code select + national number, stored as one string
 *   textarea    multi-line free text
 *   select      one value from a dropdown
 *   chips       one value from a row of pill buttons (visually a segmented control)
 *   radio       one value from a stacked list
 *   checkbox    a single boolean — consent, opt-in
 *   number      integer, with optional min/max
 *   range       two handles over a scale, submitted as "min:max"
 */
export const FORM_FIELD_TYPES = [
  "text",
  "email",
  "tel",
  "phone_dial",
  "textarea",
  "select",
  "chips",
  "radio",
  "checkbox",
  "number",
  "range",
] as const;

export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

export const FORM_FIELD_TYPE_LABELS: Record<FormFieldType, string> = {
  text: "Text",
  email: "Email",
  tel: "Phone",
  phone_dial: "Phone with dial code",
  textarea: "Long text",
  select: "Dropdown",
  chips: "Pill buttons",
  radio: "Radio list",
  checkbox: "Checkbox",
  number: "Number",
  range: "Range slider",
};

/** Types that carry a list of options. */
export const OPTION_BEARING_TYPES: readonly FormFieldType[] = [
  "select",
  "chips",
  "radio",
];

export function hasOptions(type: FormFieldType): boolean {
  return OPTION_BEARING_TYPES.includes(type);
}

/**
 * Where a field's answer ends up.
 *
 * A lead is not a bag of strings: the desk filters on `email`, routes on
 * `development_id`, and reads `message` as the brief. Mapped fields land in
 * their column on `enquiries`; everything mapped `custom` rides in
 * `form_submissions.data` and is appended to the brief as "Label: value", so
 * an editor can add a question without a migration and the advisor still sees
 * the answer.
 *
 * `first_name` / `last_name` are separate mappings rather than one `name`
 * because three of the live forms split the field in two and join them on
 * submit — the manager has to be able to describe that faithfully.
 */
export const FORM_FIELD_MAPPINGS = [
  "name",
  "first_name",
  "last_name",
  "email",
  "phone",
  "message",
  "intent",
  "timeline",
  "budget_min",
  "budget_max",
  "budget_band",
  "development_id",
  "property_id",
  "consent",
  "custom",
] as const;

export type FormFieldMapping = (typeof FORM_FIELD_MAPPINGS)[number];

export const FORM_FIELD_MAPPING_LABELS: Record<FormFieldMapping, string> = {
  name: "Full name",
  first_name: "First name",
  last_name: "Last name",
  email: "Email",
  phone: "Phone",
  message: "Message / brief",
  intent: "Intent (buy · sell · rent)",
  timeline: "Timeline",
  budget_min: "Budget — minimum",
  budget_max: "Budget — maximum",
  budget_band: "Budget band (sets both)",
  development_id: "Project",
  property_id: "Property",
  consent: "Consent",
  custom: "Extra question",
};

/** Mappings that may appear at most once on a form. */
export const SINGLETON_MAPPINGS: readonly FormFieldMapping[] =
  FORM_FIELD_MAPPINGS.filter((m) => m !== "custom");

/**
 * Options that come from live records rather than from the editor's typing.
 * The manager shows them read-only with a count — an editor picking "Off-plan
 * projects" wants today's launches, not a list frozen at edit time.
 */
export const FORM_OPTION_SOURCES = [
  "offplan_projects",
  "areas",
  "property_types",
  "consultation_interests",
] as const;

export type FormOptionSource = (typeof FORM_OPTION_SOURCES)[number];

export const FORM_OPTION_SOURCE_LABELS: Record<FormOptionSource, string> = {
  offplan_projects: "Live off-plan projects",
  areas: "Communities on file",
  property_types: "Property types",
  consultation_interests: "Consultation interests (Pages & blocks)",
};

export type FormOption = {
  label: string;
  /** Stored value. Blank means "use the label" — what a typed option does. */
  value: string;
  /**
   * The `enquiries.inferred_constraints.intent` this option tags the lead
   * with, when the field maps to `intent`. Null on ordinary options.
   */
  intent?: string | null;
};

export type FormFieldWidth = "full" | "half";

/**
 * The answer that reveals a field.
 *
 * The Buy hero asks "Property Purpose" first and then branches: a residential
 * brief is offered apartments and bedrooms, a commercial one is offered retail
 * space and no bedrooms at all. Modelling that as a condition on the field
 * rather than as a condition on each *option* keeps one concept — an editor
 * who can hide a question behind an answer can build both branches, and the
 * bedrooms question needs the same primitive anyway.
 *
 * `field` must name a field *earlier* in the list. That is enforced in
 * `formSaveSchema`, not here, because it is a property of the whole list; a
 * condition pointing forwards or at itself would make visibility depend on an
 * answer that hasn't been asked for yet.
 */
export type FormFieldCondition = {
  /** The key of an earlier field on the same form. */
  field: string;
  /** Any one of these answers reveals this field. */
  values: string[];
};

export type FormFieldDef = {
  /** Stable handle. Used as the submission key and the input name. */
  key: string;
  label: string;
  /** Arabic twins. Optional here, required-with-null on the save schema:
   *  saveForm deletes and re-inserts every field row, so an omitted twin on
   *  WRITE destroys data, while a reader that has not been taught to select
   *  them should simply fall back to the English. */
  label_ar?: string | null;
  type: FormFieldType;
  mapping: FormFieldMapping;
  placeholder?: string | null;
  placeholder_ar?: string | null;
  /** Visitor-facing hint, rendered under the input on the public page. */
  help?: string | null;
  help_ar?: string | null;
  /**
   * Editor-facing note, shown only in /admin/forms.
   *
   * Distinct from `help` because `help` is copy — it appears on the page, in
   * front of customers. "The options are edited in Pages & blocks" is a fact
   * about the CMS and belongs nowhere near the public site.
   */
  note?: string | null;
  required: boolean;
  enabled: boolean;
  width: FormFieldWidth;
  options?: FormOption[];
  optionSource?: FormOptionSource | null;
  /** textarea only. */
  rows?: number | null;
  /** number and range — the ends of the scale. */
  min?: number | null;
  max?: number | null;
  /** range only — how far one drag tick moves. */
  step?: number | null;
  /** range only — rendered before each number ("AED 2,500,000"). */
  unit?: string | null;
  unit_ar?: string | null;
  /** Null ⇒ always asked, which is every field but the Buy hero's branches. */
  showWhen?: FormFieldCondition | null;
  /**
   * A field the form cannot function without — the email box on a newsletter
   * signup, the brief on an enquiry. The editor may relabel it, but not
   * delete it, retype it, or switch it off. Keeps a form from being saved
   * into a state its handler can't submit.
   */
  locked?: boolean;
};

// ── range values ─────────────────────────────────────────────────────────

/**
 * A range answer is one string, `"min:max"`, with either side blank for
 * open-ended — exactly the shape a `budget_band` pill's option value already
 * carried before sliders existed. Keeping them identical means a form that
 * swaps its budget pills for a slider (or back) files its leads into the same
 * two columns with no second code path and no migration of past answers.
 */
export function parseRangeValue(value: unknown): {
  min: number | null;
  max: number | null;
} {
  if (typeof value !== "string" || !value.includes(":"))
    return { min: null, max: null };
  const [rawMin, rawMax] = value.split(":");
  const num = (raw: string | undefined) => {
    if (!raw || !raw.trim()) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  return { min: num(rawMin), max: num(rawMax) };
}

/** Both ends open means "no answer", which is a blank string, not "0:0". */
export function formatRangeValue(
  min: number | null,
  max: number | null,
): string {
  if (min == null && max == null) return "";
  return `${min ?? ""}:${max ?? ""}`;
}

/** The scale a slider runs over, with the fallbacks a half-configured field needs. */
export function rangeBounds(field: FormFieldDef): {
  min: number;
  max: number;
  step: number;
} {
  const min = field.min ?? 0;
  const max = field.max != null && field.max > min ? field.max : min + 1;
  const step = field.step != null && field.step > 0 ? field.step : 1;
  return { min, max, step };
}

/**
 * What a range reads as to a human — on the slider, in the advisor's brief and
 * in Responses. An open end is spelled out ("Up to AED 5,000,000") rather than
 * shown as a bound the visitor never chose.
 */
export function formatRangeLabel(field: FormFieldDef, value: unknown): string {
  const { min, max } = parseRangeValue(value);
  if (min == null && max == null) return "";
  const prefix = field.unit ? `${field.unit} ` : "";
  const num = (n: number) => `${prefix}${n.toLocaleString("en-US")}`;
  if (min == null) return `Up to ${num(max!)}`;
  if (max == null) return `${num(min)}+`;
  return `${num(min)} – ${num(max)}`;
}

/** Copy the manager owns, as opposed to the page copy in Pages & blocks. */
export type FormCopy = {
  /** Only set when `headingSource` is absent — see the file header. */
  title: string | null;
  subtitle: string | null;
  submit_label: string;
  pending_label: string;
  success_title: string;
  success_body: string;
  /** The line under the button. Null hides it. */
  consent_note: string | null;
};

/** What happens to a submission once it validates. */
export const FORM_HANDLERS = [
  "enquiry",
  "newsletter",
  "service_lead",
  "list_property",
  "valuation",
] as const;

export type FormHandler = (typeof FORM_HANDLERS)[number];

/**
 * How much of the form the manager drives.
 *
 *   full  — the public component is the shared renderer, so fields, their
 *           types and their order are live. Most forms.
 *   copy  — the public component is bespoke (a two-step wizard, an OTP gate).
 *           Visibility, copy, CTA and responses are managed; the field list is
 *           shown read-only, because changing it here would lie.
 */
export type FormControl = "full" | "copy";

/** How the fields are laid out — matches the two visual idioms on the site. */
export type FormVariant = "stacked" | "compact";

export type FormGroup = "master" | "sub" | "dialog";

export const FORM_GROUP_LABELS: Record<FormGroup, string> = {
  master: "Master pages",
  sub: "Sub-pages",
  dialog: "Dialogs & tools",
};

/**
 * How one answer becomes one search filter.
 *
 * `part` picks a side of a range; `textParam` is the escape hatch for a box
 * that suggests without constraining — a location matching a community on file
 * travels as that community's slug, and one that doesn't travels as free text,
 * because a slug invented from typing matches no property at all.
 */
export type FormSearchBinding = {
  param: string;
  part?: "value" | "min" | "max";
  textParam?: string;
};

/**
 * Where a form sends the visitor once the lead is filed.
 *
 * A button that says "Find Rentals" has to find rentals. The lead is written
 * first and the navigation happens after, so a push that never lands costs the
 * visitor a page, never the desk an enquiry.
 */
export type FormSearchRedirect = {
  path: string;
  /** Field key → the params its answer sets. */
  bind: Record<string, FormSearchBinding[]>;
};

export type FormHeadingSource = {
  pageKey: MasterPageKey;
  sectionKey: string;
  /** What the linked section actually controls, in the editor's words. */
  note: string;
};

export type FormDef = {
  key: string;
  name: string;
  /** Human name of the page it sits on — "Home page", "New projects". */
  surface: string;
  /** Public path, for the "View on site" link. */
  path: string;
  description: string;
  group: FormGroup;
  handler: FormHandler;
  control: FormControl;
  variant: FormVariant;
  /** The `enquiries.source` a submission is filed under. */
  enquirySource?: EnquirySource;
  /**
   * What the lead is filed as when no field on the form asks.
   *
   * A form on /buy is a buying lead whether or not it carries a Buy·Sell·Rent
   * control, and the Buy hero's brief deliberately doesn't: it asks what kind
   * of property, not what kind of transaction. Without this the routing rules
   * and the desk's filters would see `intent: null` on every one of them. An
   * answered intent field always wins — this is the floor, not an override.
   */
  defaultIntent?: "buy" | "sell" | "rent" | "invest" | "manage";
  /** Where the visitor goes once the lead is filed. See `FormSearchRedirect`. */
  searchRedirect?: FormSearchRedirect;
  /** Newsletter forms only. */
  newsletterSource?: string;
  headingSource?: FormHeadingSource;
  /**
   * The button, small print and confirmation are fields on the linked
   * master-page section, not on this form.
   *
   * Three of the service forms already had those strings in Pages & blocks
   * before this manager existed, and a client may well have edited them there.
   * Offering a second writable copy of the same string would be a bug dressed
   * as a feature: whichever screen you opened second would appear to have lost
   * your change. So the manager renders them read-only with a link, and owns
   * the fields, the visibility and the responses instead.
   */
  copyFromPage?: boolean;
  /**
   * Forms that must stay reachable — the contact page's own enquiry box. The
   * manager renders the toggle disabled with the reason.
   */
  alwaysOn?: boolean;
  /**
   * Prepended to the brief the advisor reads, so a form with no message box
   * still files something legible: "List my property — Sell Your Property."
   * Tokens are `{fieldKey}` (resolved to the answer's label) and `{project}` /
   * `{reference}` from the page. Kept out of `copy` because it is not
   * visitor-facing — nobody reads it but the desk.
   */
  briefPrefix?: string;
  /** Pre-filled into the message box, where the page gives it context. */
  messagePrefill?: string;
  /** Extra surfaces the same form appears on, listed in the manager. */
  alsoOn?: string[];
  copy: FormCopy;
  fields: FormFieldDef[];
};

/** One form as stored. Absent columns fall back to the registry default. */
export type StoredForm = {
  key: string;
  enabled: boolean;
  copy: Partial<FormCopy>;
  notify_emails: string[];
};

/** A form resolved for rendering or editing: definition + effective values. */
export type ResolvedForm = {
  key: string;
  def: FormDef;
  enabled: boolean;
  copy: FormCopy;
  fields: FormFieldDef[];
  notifyEmails: string[];
  /** True when nothing has been saved yet — the registry defaults are live. */
  usingDefaults: boolean;
};

export type FormSubmissionStatus = "new" | "read" | "archived";

export const FORM_SUBMISSION_STATUSES: readonly FormSubmissionStatus[] = [
  "new",
  "read",
  "archived",
];
