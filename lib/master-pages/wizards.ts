/**
 * Wizards: the multi-step forms the site runs, made editable in Pages &
 * blocks (Bazar, 9 Oct 2026: "the mortgage wizard itself, from a content and
 * form and flow standpoint, does not have an editability feature … under the
 * pages and blocks section … a new section for Wizards").
 *
 * One wizard so far, the mortgage application (`/mortgages/apply`, W1–W8).
 * Its words live in `messages/{en,ar}/mortgage.json` and every screen reads
 * them through next-intl, so this document is built FROM that catalogue
 * rather than beside it: each screen is a section, each message a field,
 * the catalogue's English and Arabic the defaults. A save stores only what
 * differs from them (wizards' `_actions.ts`), and the flow lays the stored
 * words over the catalogue at request time (`lib/queries/wizards.ts`) — so
 * every string on every screen is editable without any screen knowing, and a
 * wording fixed in code still reaches every field nobody has edited.
 *
 * What is NOT a field:
 *  - counted phrases ("{count, plural, …}"): their ICU branches are easy to
 *    break by hand and impossible to check by eye. They stay in the catalogue
 *    (the library sections keep counts out of the CMS for the same reason).
 *  - the rules: which documents each applicant uploads, formats and size
 *    limits, the 24-hour clock. Those are what the server enforces
 *    (`lib/mortgage-requests/documents.ts`, `sla.ts`), and copy that promised
 *    otherwise would be a lie the form then refuses.
 *
 * What the editor can switch is in the Flow section: the side panels and the
 * contact line on W1 and W2, and which service W1 shows first.
 */

import enMortgage from "@/messages/en/mortgage.json";
import arMortgage from "@/messages/ar/mortgage.json";
import { createTranslator } from "next-intl";
import { icuArguments, parseMessage } from "@/lib/i18n/icu";
import { PENDING_COPY } from "@/lib/mortgage-requests/copy-status";
import { area, text, toggle } from "./fields";
import { SUBPAGE_SLUG_PREFIX } from "./subpages";
import { MORTGAGE_FLOW_DEFAULTS } from "./wizard-flow";
import type { MasterPageDef, MasterPageKey, SectionDef, SectionValues, SimpleFieldDef } from "./types";

export const WIZARD_KEYS = ["mortgage-application"] as const;
export type WizardKey = (typeof WIZARD_KEYS)[number];

export function isWizardKey(value: string): value is WizardKey {
  return (WIZARD_KEYS as readonly string[]).includes(value);
}

/** `pages.slug` of a wizard's document: under the sub-page prefix, which keeps it off /pages/[slug]. */
export function wizardSlug(key: WizardKey): string {
  return `${SUBPAGE_SLUG_PREFIX}wizard/${key}`;
}

export const WIZARD_ADMIN_PATH = (key: WizardKey) => `/admin/pages/wizards/${key}`;

// ── The catalogue, flattened ─────────────────────────────────────

type Catalogue = { [key: string]: string | Catalogue };

function flatten(tree: Catalogue, prefix = ""): [string, string][] {
  return Object.entries(tree).flatMap(([k, v]) => {
    const path = prefix ? `${prefix}.${k}` : k;
    return typeof v === "string" ? [[path, v] as [string, string]] : flatten(v, path);
  });
}

const EN = new Map(flatten(enMortgage as Catalogue));
const AR = new Map(flatten(arMortgage as Catalogue));

/** A counted phrase: an ICU plural or select anywhere in the message. */
export function isCountedMessage(message: string): boolean {
  return parseMessage(message).kind === "plural" || /\{\s*\w+\s*,\s*(plural|select|selectordinal)\s*,/.test(message);
}

/** Every mortgage message the wizard editor offers, by catalogue path. */
export const MORTGAGE_EDITABLE_KEYS: readonly string[] = [...EN.entries()]
  .filter(([, message]) => !isCountedMessage(message))
  .map(([key]) => key);

// ── Screens ──────────────────────────────────────────────────────

type Screen = {
  key: string;
  label: string;
  description: string;
  /** Catalogue groups (the path's first segment) whose messages this screen shows. */
  groups: readonly string[];
};

/** The flow's screens in the order an applicant meets them. Every catalogue group belongs to exactly one. */
const MORTGAGE_SCREENS: readonly Screen[] = [
  {
    key: "shell",
    label: "Header, footer and steps",
    description: "The bar across the top of every screen (with its Exit button), the footer, the step tracker and the shared buttons.",
    groups: ["shell", "stepper", "actions", "common", "track"],
  },
  {
    key: "w1",
    label: "Step 1 · Choose a service",
    description: "W1: the two service cards, the side panel that explains them and the contact line.",
    groups: ["w1", "service"],
  },
  {
    key: "w2",
    label: "Step 2 · Personal details",
    description: "W2: residency and employment, name, date of birth, mobile and email — labels, placeholders, hints and the messages a mistake shows.",
    groups: ["w2", "field", "residency", "employment"],
  },
  {
    key: "w3",
    label: "Consultancy · Review and submit",
    description: "W3 and W4: the summary a Mortgage Consultancy applicant checks before sending, and what it says happens next.",
    groups: ["w3", "w4", "summary", "selections", "consultNext"],
  },
  {
    key: "documents",
    label: "Fast Pre-Approval · Documents",
    description:
      "W5 and W6: the documents list, each document's name and hint, the upload rows and their messages, the consent and the security note.",
    groups: ["w5", "w6", "docs", "doc", "upload", "consent", "security", "preNext"],
  },
  {
    key: "submit",
    label: "Sending",
    description: "What the submit button says while it works, and the messages when a submission doesn't go through.",
    groups: ["submit"],
  },
  {
    key: "w7",
    label: "Request received",
    description: "W7: the confirmation screen, with the reference and what happens next.",
    groups: ["w7", "received"],
  },
  {
    key: "w8",
    label: "Secure link",
    description:
      "W8: the page an applicant opens from the team's email — to send a document again, or to apply after a consultation. The code screen, every state of the link, and the upload.",
    groups: ["w8"],
  },
];

// ── Labels ───────────────────────────────────────────────────────

/** Words the catalogue's keys use, as an editor reads them. */
const WORDS: Record<string, string> = {
  cta: "button",
  desc: "description",
  lede: "intro",
  sub: "subtitle",
  w1: "",
  w2: "",
  w3: "",
  w4: "",
  w5: "",
  w6: "",
  w7: "",
  w8: "",
  uaeNational: "UAE national",
  expat: "resident / expat",
  preApproval: "Fast Pre-Approval",
  consultancy: "Mortgage Consultancy",
  emiratesId: "Emirates ID",
  dob: "date of birth",
  dateOfBirth: "date of birth",
  aria: "screen-reader text",
  a11y: "screen-reader text",
};

function words(segment: string): string {
  if (segment in WORDS) return WORDS[segment]!;
  return segment
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/(\d+)m$/, " $1 months")
    .toLowerCase();
}

function pendingNote(path: string): string | null {
  const hit = PENDING_COPY.find((p) => (p.key.endsWith(".*") ? path.startsWith(p.key.slice(0, -1)) : p.key === path));
  return hit ? hit.gap : null;
}

/** "w2.dateOfBirth.placeholder" → "Date of birth · placeholder", marked when its wording still awaits sign-off. */
function labelFor(path: string): string {
  const parts = path.split(".").map(words).filter(Boolean);
  const label = parts.join(" · ");
  const pretty = label.charAt(0).toUpperCase() + label.slice(1);
  const pending = pendingNote(path);
  return pending ? `${pretty} (awaiting sign-off: ${pending})` : pretty;
}

// ── Fields ───────────────────────────────────────────────────────

/** Copy that is data, not prose: kept the same in Arabic, with no Arabic twin to fill. */
function isData(message: string): boolean {
  const bare = message.replace(/\{\w+\}|<\/?\w+>/g, "").trim();
  if (/^\S+@\S+\.\S+$/.test(bare) || /^https?:\/\//.test(bare)) return true; // an email or a link
  return !/\p{L}{3,}/u.test(bare);
}

function fieldFor(path: string): SimpleFieldDef {
  const message = EN.get(path)!;
  const long = message.length > 90 || message.includes("<");
  const max = Math.max(long ? 600 : 160, Math.ceil(message.length * 2));
  const extra: Partial<SimpleFieldDef> = { max, optional: false, ...(isData(message) ? { i18n: false } : {}) };
  return long ? area(path, labelFor(path), extra) : text(path, labelFor(path), extra);
}

function screenOf(path: string): string {
  const group = path.split(".")[0]!;
  const screen = MORTGAGE_SCREENS.find((s) => s.groups.includes(group));
  if (!screen) throw new Error(`wizards: catalogue group "${group}" belongs to no screen`);
  return screen.key;
}

export { MORTGAGE_FLOW_DEFAULTS, type MortgageFlowSettings } from "./wizard-flow";

const FLOW_SECTION: SectionDef = {
  key: "flow",
  label: "Flow",
  description: "What the wizard shows, rather than what it says.",
  locked: true,
  dataNote:
    "Which documents each applicant uploads, the formats and size limits, and the 24-hour clock are the form's rules, enforced when it's sent: they aren't set here. Phone and WhatsApp numbers are in the copy (Step 1's contact line, the footer): edit the number there and its link follows.",
  fields: [
    {
      key: "w1_first",
      label: "Step 1 leads with",
      kind: "select",
      options: [
        { value: "consultancy", label: "Mortgage Consultancy (as designed)" },
        { value: "pre_approval", label: "Fast Pre-Approval" },
      ],
      help: "The card on the left. A link that names a service still opens with that service chosen.",
    },
    toggle("show_w1_rail", "Step 1's side panel", "The \"Which one is right for you?\" panel beside the two service cards."),
    toggle("show_w1_contact", "Step 1's contact line", "\"Prefer to talk it through? Call … or WhatsApp …\" under the side panel."),
    toggle("show_w2_rail", "Step 2's side panel", "The panel beside the personal details that explains why each answer is asked for."),
  ],
  defaults: { ...MORTGAGE_FLOW_DEFAULTS },
};

function buildSections(): SectionDef[] {
  const byScreen = new Map<string, string[]>(MORTGAGE_SCREENS.map((s) => [s.key, []]));
  for (const path of MORTGAGE_EDITABLE_KEYS) byScreen.get(screenOf(path))!.push(path);
  const copySections = MORTGAGE_SCREENS.map((screen): SectionDef => {
    const paths = byScreen.get(screen.key)!;
    const defaults: SectionValues = {};
    for (const path of paths) {
      defaults[path] = EN.get(path)!;
      const field = fieldFor(path);
      if (field.i18n !== false) defaults[`${path}_ar`] = AR.get(path) ?? EN.get(path)!;
    }
    return {
      key: screen.key,
      label: screen.label,
      description: screen.description,
      locked: true,
      dataNote:
        "Keep anything in {curly braces} and the <b>…</b> or <ink>…</ink> marks: they're filled in, or styled, as the applicant reads it. The wizard is in English for now (decision D12); the Arabic is kept for when it opens in Arabic.",
      fields: paths.map(fieldFor),
      defaults,
    };
  });
  return [FLOW_SECTION, ...copySections];
}

const MORTGAGE_SECTIONS = buildSections();

export type WizardDef = {
  key: WizardKey;
  label: string;
  description: string;
  /** Where it runs, for the "Open the wizard" link. */
  path: string;
  /** Next-intl namespace its copy lives in. */
  namespace: "mortgage";
};

export const WIZARDS: readonly WizardDef[] = [
  {
    key: "mortgage-application",
    label: "Mortgage application",
    description:
      "Fast Pre-Approval and Mortgage Consultancy: every screen of /mortgages/apply and the secure link, word for word, and what the flow shows.",
    path: "/mortgages/apply",
    namespace: "mortgage",
  },
];

export function getWizard(key: WizardKey): WizardDef {
  return WIZARDS.find((w) => w.key === key)!;
}

/** The wizard's document as the master-page machinery reads it. */
export function wizardPageDef(key: WizardKey): MasterPageDef {
  const wizard = getWizard(key);
  return {
    key: `wizard/${key}` as unknown as MasterPageKey,
    label: wizard.label,
    path: wizard.path,
    description: wizard.description,
    sections: MORTGAGE_SECTIONS,
  };
}

/** Exported for the guards that enumerate every registry's sections. */
export function wizardSections(): SectionDef[] {
  return MORTGAGE_SECTIONS;
}

/** The catalogue's English for a path, the default a stored value is compared against. */
export function catalogueEnglish(path: string): string | undefined {
  return EN.get(path);
}

/** The catalogue's Arabic for a path. */
export function catalogueArabic(path: string): string | undefined {
  return AR.get(path);
}

// ── Saving ───────────────────────────────────────────────────────

const TAG = /<\/?([a-z]+)>/g;

function tagsOf(message: string): string[] {
  return [...message.matchAll(TAG)].map((m) => m[0]).sort();
}

function formats(message: string, args: readonly string[]): boolean {
  let failed = false;
  const t = createTranslator({
    locale: "en",
    messages: { check: { message } },
    namespace: "check",
    onError: () => {
      failed = true;
    },
    getMessageFallback: () => "",
  });
  const sample = Object.fromEntries(args.map((a) => [a, "x"]));
  const tag = (chunks: string) => chunks;
  t.markup("message", { ...sample, b: tag, ink: tag, link: tag });
  return !failed;
}

export type WizardCopyIssue = { section: string; field: string; message: string };

/**
 * What a save must keep of each message, English and Arabic: the same
 * `{placeholders}` (the flow fills them in — a dropped `{firstName}` greets
 * nobody, a new `{name}` goes live in braces), the same `<b>`/`<ink>`/`<link>`
 * marks, and a message next-intl can format at all (an unbalanced brace
 * would render the key path instead of the sentence).
 */
export function wizardCopyIssues(key: WizardKey, sections: readonly { key: string; values: SectionValues }[]): WizardCopyIssue[] {
  const def = wizardPageDef(key);
  const issues: WizardCopyIssue[] = [];
  for (const section of sections) {
    const sectionDef = def.sections.find((s) => s.key === section.key);
    if (!sectionDef || section.key === "flow") continue;
    for (const field of sectionDef.fields) {
      const english = EN.get(field.key);
      if (english === undefined) continue;
      const args = icuArguments(english);
      for (const [lang, value] of [
        ["English", section.values[field.key]],
        ["Arabic", section.values[`${field.key}_ar`]],
      ] as const) {
        if (typeof value !== "string" || !value.trim()) continue;
        const where = { section: sectionDef.label, field: lang === "Arabic" ? `${field.label} (Arabic)` : field.label };
        const kept = icuArguments(value);
        const missing = args.filter((a) => !kept.includes(a));
        const extra = kept.filter((a) => !args.includes(a));
        if (missing.length) issues.push({ ...where, message: `Keep ${missing.map((a) => `{${a}}`).join(", ")}: it's filled in as the applicant reads it.` });
        if (extra.length) issues.push({ ...where, message: `${extra.map((a) => `{${a}}`).join(", ")} isn't something this message can fill in.` });
        if (tagsOf(value).join() !== tagsOf(english).join()) {
          issues.push({ ...where, message: "Keep the <b>…</b>, <ink>…</ink> and <link>…</link> marks exactly as the default has them." });
        } else if (!missing.length && !extra.length && !formats(value, args)) {
          issues.push({ ...where, message: "This can't be shown as written: check for a stray { or }." });
        }
      }
    }
  }
  return issues;
}

/**
 * The document as stored: only what differs from the catalogue, so a field
 * nobody edited keeps following the catalogue when its wording changes in
 * code. The Flow switches are kept as set.
 */
export function wizardStoredValues<T extends { key: string; enabled: boolean; values: SectionValues }>(sections: readonly T[]): T[] {
  return sections.map((section) => {
    if (section.key === "flow") return section;
    const values: SectionValues = {};
    for (const [k, v] of Object.entries(section.values)) {
      const isAr = k.endsWith("_ar");
      const path = isAr ? k.slice(0, -3) : k;
      const base = isAr ? AR.get(path) : EN.get(path);
      if (v === null || v === undefined || v === "" || v === base) continue;
      values[k] = v;
    }
    return { ...section, values };
  });
}
