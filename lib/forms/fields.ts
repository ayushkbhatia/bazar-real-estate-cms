/**
 * Field builders for the form registry.
 *
 * These exist so a registry entry reads like the form it describes rather than
 * like a wall of object literals, and so the handful of blocks that genuinely
 * repeat across forms — name / email / phone — are written once. A builder
 * returns a plain `FormFieldDef`; nothing here is clever, and every default it
 * fills in is overridable at the call site.
 */

import type {
  FormFieldDef,
  FormFieldMapping,
  FormFieldType,
  FormFieldWidth,
  FormOption,
  FormOptionSource,
} from "./types";

/** Anything a call site may override — including the label the builder picks. */
type Extras = Partial<Omit<FormFieldDef, "key" | "type" | "mapping">>;

export function field(
  key: string,
  label: string,
  type: FormFieldType,
  mapping: FormFieldMapping,
  extras: Extras = {},
): FormFieldDef {
  return {
    key,
    label,
    type,
    mapping,
    placeholder: null,
    help: null,
    required: false,
    enabled: true,
    width: "full" as FormFieldWidth,
    ...extras,
  };
}

/** Options typed by an editor — value defaults to the label. */
export function options(
  ...items: (string | [label: string, value: string] | FormOption)[]
): FormOption[] {
  return items.map((item) => {
    if (typeof item === "string") return { label: item, value: item };
    if (Array.isArray(item)) return { label: item[0], value: item[1] };
    return item;
  });
}

/**
 * The dial codes the phone fields offer today. They live on the field as
 * ordinary options so an editor can add +91 without a deploy.
 */
export const DEFAULT_DIAL_CODES = options("+971", "+966", "+44", "+1");

// ── contact block ────────────────────────────────────────────────────────

export function fullName(extras: Extras = {}): FormFieldDef {
  return field("name", "Name", "text", "name", {
    placeholder: "Full name",
    required: true,
    ...extras,
  });
}

export function firstName(extras: Extras = {}): FormFieldDef {
  return field("first_name", "First name", "text", "first_name", {
    placeholder: "First name",
    required: true,
    width: "half",
    ...extras,
  });
}

export function lastName(extras: Extras = {}): FormFieldDef {
  return field("last_name", "Last name", "text", "last_name", {
    placeholder: "Last name",
    width: "half",
    ...extras,
  });
}

export function email(extras: Extras = {}): FormFieldDef {
  return field("email", "Email", "email", "email", {
    placeholder: "you@example.com",
    ...extras,
  });
}

export function phone(extras: Extras = {}): FormFieldDef {
  return field("phone", "Phone", "tel", "phone", {
    placeholder: "+971 50 …",
    ...extras,
  });
}

export function dialPhone(extras: Extras = {}): FormFieldDef {
  return field("phone", "Phone number", "phone_dial", "phone", {
    placeholder: "50 000 0000",
    options: DEFAULT_DIAL_CODES,
    ...extras,
  });
}

export function message(label = "Message", extras: Extras = {}): FormFieldDef {
  return field("message", label, "textarea", "message", {
    rows: 4,
    required: true,
    ...extras,
  });
}

// ── qualification ────────────────────────────────────────────────────────

/** The Buy / Sell / Rent segmented control on the generic enquiry form. */
export function intentChips(extras: Extras = {}): FormFieldDef {
  return field("intent", "I'm looking to", "chips", "intent", {
    options: [
      { label: "Buy", value: "buy", intent: "buy" },
      { label: "Sell", value: "sell", intent: "sell" },
      { label: "Rent", value: "rent", intent: "rent" },
    ],
    ...extras,
  });
}

export function timelineChips(extras: Extras = {}): FormFieldDef {
  return field("timeline", "Timeline", "chips", "timeline", {
    options: options(
      ["Ready to buy", "now"],
      ["Next 3 months", "three_months"],
      ["Next 6 months", "six_months"],
      ["Just exploring", "browsing"],
    ),
    ...extras,
  });
}

export function recordSelect(
  key: string,
  label: string,
  mapping: FormFieldMapping,
  source: FormOptionSource,
  extras: Extras = {},
): FormFieldDef {
  return field(key, label, "select", mapping, {
    optionSource: source,
    ...extras,
  });
}
