/**
 * The words every advisor profile shares — the crumb, the pull quote, the
 * contact buttons and the WhatsApp message behind one of them, and the
 * eyebrow and heading above each band on `/agents/<slug>`.
 *
 * ## Why a registry rather than literals in the page
 *
 * These were split across three places: literals in
 * `app/[locale]/(public)/agents/[slug]/page.tsx` ("Call", "Working with …",
 * "What … is bringing to market.", the empty state, "Work with …"), and two
 * catalogue namespaces (`editorial.agent.*`, `pages.agent.*`) for the rest.
 * None of it was reachable from the CMS, so the page was missing from Pages &
 * blocks altogether — and the literals were the one class of prose on the
 * route that `/ar/agents/<slug>` could not render in Arabic, so four headings
 * and the Call button printed English over an Arabic bio.
 *
 * ## Why ONE document, plus one per advisor
 *
 * The same split `development-page.ts` makes, for the same reason. These
 * strings are the template, identical on every profile; the per-advisor part
 * arrives as a TOKEN rather than as typing, so "rename the listings heading" is
 * one edit rather than one per advisor. Each advisor's own document
 * (`AGENT_SECTIONS` in `./subpages.ts`) holds optional overrides of these
 * fields and which bands show — a blank override falls through to here.
 *
 * ## Resolution order, per field
 *
 *   1. the advisor's own override  (`subpage/agent/<user_id>`)
 *   2. this document               (`subpage/agent-copy/shared`)
 *   3. the code defaults below
 *
 * ## What is deliberately NOT here
 *
 *  - The advisor: name, title, portrait, bio, BRN, specialties, languages and
 *    the phone, email and WhatsApp number behind the buttons. Those are the
 *    team record, edited in Agents & team.
 *  - "BRN", the label over the licence number. It is a regulatory identifier,
 *    not prose, and ADR-0008 §5 keeps those out of translation.
 *  - The link behind "Send a brief". It is structural — the contact page — and
 *    a link field an editor can point anywhere is how a profile ends up with a
 *    button to a 404; `/partners` takes the same line for its closing band.
 *
 * ## Tokens
 *
 * `{name}` is the advisor's display name and `{first_name}` its first word.
 * Substituted by `fillTokens` (from `developer-page.ts`, so a token that works
 * in one registry works in the others), and bidi-isolated under Arabic: an
 * advisor whose `display_name_ar` is unwritten arrives as Latin text inside an
 * Arabic sentence.
 *
 * ## The Arabic
 *
 * Hand-declared beside each English sibling. Every field that was a catalogue
 * key keeps the Arabic the catalogue shipped, byte for byte, so `/ar` reads as
 * it did; the four that were literals had none and get a first draft in the
 * sense of ADR-0008. The client's edit wins structurally, because
 * `mergeValues` never overwrites a twin that holds a value.
 *
 * ## Storage, and the namespace it deliberately avoids
 *
 * `pages.blocks` under `subpage/agent-copy/shared`, not
 * `subPageSlug("agent", …)`: that namespace is written per RECORD, and one
 * document there per advisor sits beside this one. A separate namespace means
 * no record can ever land on this row — the reasoning `development-page.ts`
 * sets out at length.
 */

import { area, text } from "./fields";
import { fillTokens } from "./developer-page";
import type { FieldDef, MasterPageDef, MasterPageKey, SectionDef } from "./types";

export { fillTokens };

/** The document's key — the last segment of its slug. */
export const AGENT_PAGE_COPY_KEY = "shared";

/**
 * The namespace between `SUBPAGE_SLUG_PREFIX` and the key. The slug itself is
 * assembled in `lib/queries/agent-page.ts`: `subpages.ts` imports this module
 * for its editor placeholders, so importing the prefix back would close a
 * cycle — see the same note on `DEVELOPMENT_PAGE_COPY_NAMESPACE`.
 */
export const AGENT_PAGE_COPY_NAMESPACE = "agent-copy";

/** Where an editor goes, and what the Agents sub-page index links to. */
export const AGENT_PAGE_ADMIN_PATH = "/admin/pages/sub/agent/copy";

/**
 * Every token the strings below may carry, keyed by the name the renderer
 * fills it from.
 *
 * Exported because the editor's help text, the save check, the tests and the
 * renderer must all agree about the exact spelling — a token documented as
 * `{first_name}` and substituted as `{firstName}` is a silent no-op that only
 * shows up on the public page.
 */
export const AGENT_TOKENS = {
  name: "{name}",
  first_name: "{first_name}",
} as const;

export type AgentTokens = Record<keyof typeof AGENT_TOKENS, string>;

const NAME = AGENT_TOKENS.name;
const FIRST_NAME = AGENT_TOKENS.first_name;

const TOKEN_HELP = `Use ${FIRST_NAME} for the advisor's first name or ${NAME} for their full name.`;

const AGENTS_ADMIN = { label: "Agents & team", href: "/admin/agents" } as const;

/**
 * An eyebrow is a label, not a sentence — 80 characters, and required: a band
 * whose eyebrow an editor clears is an unlabelled band rather than a tidier
 * one. Every field here is required for the same reason, which is the
 * difference between this document and the per-advisor overrides it backs:
 * those are optional *because* this exists to catch them.
 */
const eyebrowField = (key = "eyebrow", label = "Eyebrow"): FieldDef =>
  text(key, label, { max: 80 });

const headingField = (help = TOKEN_HELP): FieldDef =>
  text("heading", "Heading", { max: 160, help });

function band(
  key: string,
  label: string,
  description: string,
  fields: FieldDef[],
  defaults: SectionDef["defaults"],
  extra: Pick<SectionDef, "dataNote" | "dataLink"> = {},
): SectionDef {
  return {
    key,
    label,
    description,
    // Locked throughout. Whether a band shows on a given profile is that
    // advisor's decision and lives in their own document; a switch here would
    // read as a site-wide kill switch and behave as neither.
    locked: true,
    fields,
    defaults,
    ...extra,
  };
}

/** One section per band, in the order the profile draws them. */
export const AGENT_PAGE_COPY_SECTIONS: SectionDef[] = [
  band(
    "hero",
    "Profile header",
    "The link back to the team, the pull quote, and the contact buttons beside the portrait.",
    [
      text("back_label", "Back link", {
        max: 60,
        help: "The crumb above the portrait, linking to /agents.",
      }),
      text("title_fallback", "Eyebrow for an advisor with no title", {
        max: 60,
        help: "Above the name, and after it in the browser tab, when the team record has no title.",
      }),
      area("quote", "Pull quote", {
        max: 300,
        optional: false,
        help: TOKEN_HELP,
      }),
      text("call_label", "Call button", { max: 60 }),
      text("whatsapp_label", "WhatsApp button", { max: 60 }),
      area("whatsapp_message", "WhatsApp message", {
        max: 300,
        optional: false,
        help: `The message WhatsApp opens already holding. ${TOKEN_HELP}`,
      }),
      text("email_label", "Email button", { max: 60 }),
    ],
    {
      back_label: "Our team",
      back_label_ar: "فريقنا",
      title_fallback: "Advisor",
      title_fallback_ar: "المستشار",
      quote: `${FIRST_NAME} works the full advisory cycle end to end.`,
      quote_ar: `يغطي ${FIRST_NAME} دورة الاستشارة كاملةً من البداية إلى النهاية.`,
      call_label: "Call",
      call_label_ar: "اتصل",
      whatsapp_label: "WhatsApp",
      whatsapp_label_ar: "واتساب",
      whatsapp_message: `Hi ${FIRST_NAME}, I'd like to talk about a Bazar engagement.`,
      whatsapp_message_ar: `مرحباً ${FIRST_NAME}، أودّ التحدث بشأن تعاون مع بازار.`,
      email_label: "Email",
      email_label_ar: "البريد الإلكتروني",
    },
    {
      dataNote:
        "The portrait, name, title, bio and the number or address behind each button are the advisor's team record. A button only shows when the record holds the detail behind it.",
      dataLink: AGENTS_ADMIN,
    },
  ),
  band(
    "expertise",
    "Specialties & languages",
    "The two columns under the licence number.",
    [
      eyebrowField("specialties_eyebrow", "Specialties heading"),
      eyebrowField("languages_eyebrow", "Languages heading"),
    ],
    {
      specialties_eyebrow: "Specialties",
      specialties_eyebrow_ar: "المجالات المتخصصة",
      languages_eyebrow: "Languages",
      languages_eyebrow_ar: "اللغات",
    },
    {
      dataNote:
        "The specialties and languages themselves are ticked on the advisor's team record, in both languages.",
      dataLink: AGENTS_ADMIN,
    },
  ),
  band(
    "reviews",
    "Client reviews",
    "The approved reviews filed against the advisor.",
    [eyebrowField(), headingField()],
    {
      eyebrow: "What clients say",
      eyebrow_ar: "آراء العملاء",
      heading: `Working with ${FIRST_NAME}.`,
      heading_ar: `العمل مع ${FIRST_NAME}.`,
    },
    {
      dataNote:
        "The reviews are the approved ones filed against this advisor. The band only appears once there is at least one.",
    },
  ),
  band(
    "listings",
    "Active listings",
    "The advisor's newest published listings.",
    [
      eyebrowField(),
      headingField(),
      area("empty", "No-listings message", {
        max: 300,
        optional: false,
        help: `Shown in place of the cards while the advisor has no published listings. ${TOKEN_HELP}`,
      }),
    ],
    {
      eyebrow: "Active listings",
      eyebrow_ar: "المعروضات النشطة",
      heading: `What ${FIRST_NAME} is bringing to market.`,
      heading_ar: `ما يطرحه ${FIRST_NAME} في السوق.`,
      empty: `No public listings on the desk this week. Open a brief to discuss what ${FIRST_NAME} is working on off-market.`,
      empty_ar: `لا توجد إعلانات عقارية منشورة على مكتبه هذا الأسبوع. أرسل طلبك لمناقشة ما يعمل عليه ${FIRST_NAME} بعيداً عن السوق المعلنة.`,
    },
    {
      dataNote:
        "The cards are the six newest published listings assigned to the advisor — assigned on each property's record.",
      dataLink: { label: "Properties", href: "/admin/properties" },
    },
  ),
  band(
    "cta",
    "Closing band",
    "The accent band at the foot of the profile and its button to the contact page.",
    [
      eyebrowField(),
      headingField(),
      text("cta_label", "Button", { max: 60 }),
    ],
    {
      eyebrow: "Get in touch",
      eyebrow_ar: "تواصل معنا",
      heading: `Work with ${FIRST_NAME}.`,
      heading_ar: `اعمل مع ${FIRST_NAME}.`,
      cta_label: "Send a brief",
      cta_label_ar: "أرسل طلبك",
    },
    {
      dataNote:
        "The button opens the contact page. Where it leads is fixed; its words are here.",
    },
  ),
];

/**
 * The document presented as a `MasterPageDef`, so it goes straight through
 * `resolveSections` / `validateSections` and into the shared editor without a
 * parallel implementation — the same trick `developerPageCopyDef` uses.
 */
export function agentPageCopyDef(): MasterPageDef {
  return {
    key: `agent/${AGENT_PAGE_COPY_KEY}` as unknown as MasterPageKey,
    label: "Advisor profiles",
    path: "/agents",
    description:
      "The crumb, pull quote, buttons, eyebrows and headings every /agents/<slug> profile shares.",
    sections: AGENT_PAGE_COPY_SECTIONS,
  };
}

/** Exported for the guards that enumerate every registry's field lists. */
export function agentPageFieldLists(): {
  origin: string;
  fields: FieldDef[];
}[] {
  return AGENT_PAGE_COPY_SECTIONS.map((s) => ({
    origin: `agent-page:${s.key}`,
    fields: s.fields,
  }));
}

/**
 * The shipped wording for one field, or null if this document does not carry
 * it. Pass `<field>_ar` for the Arabic.
 *
 * Exists so the per-advisor editor (`AGENT_SECTIONS` in `./subpages.ts`) can
 * show the shared wording greyed in each empty box without retyping it — the
 * one copy of each string is here.
 */
export function agentPageCopyDefault(
  sectionKey: string,
  field: string,
): string | null {
  const section = AGENT_PAGE_COPY_SECTIONS.find((s) => s.key === sectionKey);
  const value = section?.defaults[field];
  return typeof value === "string" && value.trim() !== "" ? value : null;
}
