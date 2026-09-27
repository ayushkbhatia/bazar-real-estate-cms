/**
 * A form submission, read back as the advisor needs it.
 *
 * `form_submissions.data` holds every answer keyed by field key, plus a
 * `_labels` snapshot of the questions (0094). It is evidence, and it is stored
 * the way evidence should be: `budget` as `"1000000:3000000"`, a bedroom pick
 * as `"6_plus"`, a project as its uuid. None of that is fit to read. The
 * Responses table in /admin/forms shows it close to raw; this is the reading
 * that belongs beside the lead.
 *
 * Two things the stored shape does NOT give you, and which this restores:
 *
 *   - Order. `data` is jsonb, and jsonb keeps keys sorted by length, not in the
 *     order the form asked them. The form's own field list is the order.
 *   - Which labels to trust. The shared renderer freezes the labels it
 *     actually drew, so on those forms the snapshot is what the visitor saw.
 *     The two bespoke handlers (the owner wizard and the valuation gate) write
 *     constants that have already drifted from their pages — "I want to" for a
 *     question the page asks as "I am looking to" — so there the snapshot is
 *     only a fallback.
 *
 * Pure. The page fetches; this decides what each answer says.
 */

import { optionLabel } from "@/lib/forms/submission";
import {
  formatRangeLabel,
  hasOptions,
  type FormDef,
  type FormFieldDef,
  type FormFieldMapping,
} from "@/lib/forms/types";
import { humanise } from "./origin";

export type Answer = {
  key: string;
  /** The question, in the words the form uses today. */
  label: string;
  /**
   * The wording the visitor actually read, when it differs from `label` — a
   * question reworded since, or the Arabic label on a lead from `/ar`.
   */
  askedAs: string | null;
  value: string;
  /** Free text that wants the full width of the card. */
  long: boolean;
};

export type ReadAnswers = {
  /**
   * What they told us, in the order the form asked it. Name, email and phone
   * are left out: the lead card shows the stored copy of each, and a second
   * copy of the same three facts pushes the answers that matter down the page.
   */
  answers: Answer[];
  /** The consent box, when the form asked for one. */
  consented: boolean | null;
  /**
   * Questions they were shown and left empty. Only reported where the record
   * is trustworthy about what was shown — see `recordsOnlyAsked`.
   */
  skipped: string[];
  /** The mortgage calculator's numbers at the moment they pressed send. */
  scenario: string | null;
};

const CONTACT_MAPPINGS: ReadonlySet<FormFieldMapping> = new Set([
  "name",
  "first_name",
  "last_name",
  "email",
  "phone",
]);

/** Contact keys in a record whose form this code no longer knows. */
const CONTACT_KEYS = new Set([
  "name",
  "first_name",
  "last_name",
  "email",
  "phone",
  "mobile",
]);

/** Longer than this, an answer is prose and gets the full width. */
const LONG_ANSWER = 60;

/**
 * Whether a submission holds exactly the questions its visitor was asked,
 * under the labels they read.
 *
 * True for every form that goes through the shared renderer's action, which
 * builds the record from `activeFields` — a branch the visitor never opened
 * has no entry at all, so an entry with no answer is a question they skipped.
 * The owner wizard writes `bedrooms: null` for a plot of land, where nobody
 * asked, so the same inference there would be a lie.
 */
export function recordsOnlyAsked(def: FormDef | null): boolean {
  return def?.handler === "enquiry" || def?.handler === "service_lead";
}

/** Record ids an answer may hold, with the names the enquiry already joined. */
export type AnswerRecords = {
  development?: { id: string; name: string } | null;
  property?: { id: string; label: string } | null;
};

export function readAnswers(input: {
  /** Answers keyed by field key — `_labels` already split off. */
  data: Record<string, unknown>;
  /** The question labels as frozen at submission. */
  labels: Record<string, string>;
  /** The form's registry definition, when its key still names one. */
  def: FormDef | null;
  /** The form's fields as they stand, for option labels, units and order. */
  fields: FormFieldDef[] | null;
  records?: AnswerRecords;
}): ReadAnswers {
  const { data, labels, def, records = {} } = input;
  const fields = input.fields ?? def?.fields ?? [];
  const faithful = recordsOnlyAsked(def);
  const fieldByKey = new Map(fields.map((f) => [f.key, f]));
  const position = new Map(fields.map((f, i) => [f.key, i]));

  const out: ReadAnswers = {
    answers: [],
    consented: null,
    skipped: [],
    scenario: null,
  };

  const keys = Object.keys(data)
    .filter((key) => key !== "_labels")
    .sort((a, b) => {
      const pa = position.get(a) ?? Number.MAX_SAFE_INTEGER;
      const pb = position.get(b) ?? Number.MAX_SAFE_INTEGER;
      if (pa !== pb) return pa - pb;
      // Underscore keys are the page's context rather than the visitor's
      // answers; they read last.
      const ua = a.startsWith("_") ? 1 : 0;
      const ub = b.startsWith("_") ? 1 : 0;
      return ua !== ub ? ua - ub : a.localeCompare(b);
    });

  for (const key of keys) {
    const raw = data[key];

    if (key === "_scenario") {
      const text = typeof raw === "string" ? raw.trim() : "";
      out.scenario = text || null;
      continue;
    }

    const field = fieldByKey.get(key) ?? null;
    const role = roleOf(key, field);

    if (role === "contact") continue;
    if (role === "consent") {
      if (typeof raw === "boolean") out.consented = raw;
      continue;
    }

    // Today's label leads so every lead reads in the desk's English whichever
    // site it came from; the frozen one follows where it says something else.
    const frozen = labels[key]?.trim() || null;
    const current = field?.label?.trim() || null;
    const label = current ?? frozen ?? humanise(key.replace(/^_+/, ""));
    const askedAs =
      faithful && frozen && current && normalise(frozen) !== normalise(current)
        ? frozen
        : null;

    const value = displayAnswer(raw, key, field, records);
    if (value === null) {
      if (faithful) out.skipped.push(label);
      continue;
    }

    out.answers.push({
      key,
      label,
      askedAs,
      value,
      long:
        field?.type === "textarea" ||
        field?.mapping === "message" ||
        value.length > LONG_ANSWER ||
        value.includes("\n"),
    });
  }

  return out;
}

type Role = "contact" | "consent" | "answer";

function roleOf(key: string, field: FormFieldDef | null): Role {
  if (field) {
    if (CONTACT_MAPPINGS.has(field.mapping)) return "contact";
    if (field.mapping === "consent") return "consent";
    return "answer";
  }
  if (key === "consent") return "consent";
  return CONTACT_KEYS.has(key) ? "contact" : "answer";
}

/**
 * One stored value as a person reads it, or null when there is no answer.
 *
 * `false` on a checkbox is an answer ("No"); an empty string is not.
 */
export function displayAnswer(
  raw: unknown,
  key: string,
  field: FormFieldDef | null,
  records: AnswerRecords = {},
): string | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "boolean") return raw ? "Yes" : "No";
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? withUnit(raw, field?.unit ?? unitFromKey(key)) : null;
  }
  if (typeof raw !== "string") {
    // Arrays and objects are not something any form writes today. Show them
    // rather than drop them — a question added next year should not vanish.
    try {
      return JSON.stringify(raw);
    } catch {
      return null;
    }
  }

  const value = raw.trim();
  if (!value) return null;
  if (!field) return value;

  if (field.type === "range") return formatRangeLabel(field, value) || null;

  if (field.mapping === "development_id") {
    return records.development?.id === value
      ? records.development.name
      : "A project no longer on file";
  }
  if (field.mapping === "property_id") {
    return records.property?.id === value
      ? records.property.label
      : "A listing no longer on file";
  }

  if (hasOptions(field.type) || field.optionSource) {
    const label = optionLabel(field, value);
    if (label !== value) return label;
    // A live option list (property types, communities) isn't loaded here, and
    // its values are slugs. "hotel_apartment" should still read as words.
    return SLUG.test(value) ? humanise(value) : value;
  }

  return value;
}

/** Lower-case words joined by `_` or `-` — a stored value, not prose. */
const SLUG = /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/;

/** A currency code leads ("AED 1,250,000"); any other unit trails ("1,450 ft²"). */
function withUnit(n: number, unit: string | null): string {
  const text = n.toLocaleString("en-US");
  if (!unit) return text;
  return /^[A-Z]{3}$/.test(unit) ? `${unit} ${text}` : `${text} ${unit}`;
}

/** Units for the bespoke handlers' numeric answers, which have no field def. */
function unitFromKey(key: string): string | null {
  if (key.endsWith("_aed")) return "AED";
  if (key.endsWith("_sqft") || key.endsWith("_ft2")) return "ft²";
  return null;
}

function normalise(label: string): string {
  return label.replace(/\s+/g, " ").trim().toLowerCase();
}
