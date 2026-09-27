/**
 * /agents — the advisor team index.
 *
 * WHY THIS FILE EXISTS
 *
 * `/agents` was a public marketing page with no master page at all, so it was
 * missing from Pages & blocks entirely. Every word on it was a literal in
 * `agents/page.tsx` or `lib/agents/desk.ts`: the headline, the standfirst, all
 * four desk headings and their intros, the message the WhatsApp badge opens,
 * and the `export const metadata`. An editor could not change any of it, and —
 * because the master-page system is also where Arabic twins live —
 * `/ar/agents` rendered its headline and every desk in English under
 * `lang="ar"`.
 *
 * WHAT IS AND IS NOT EDITABLE
 *
 * The page's own words are editable here. The advisors are not, and cannot
 * be: each card is one team record — name, title, portrait, specialties,
 * languages, WhatsApp number — edited in Agents & team, and whether a record
 * appears at all is decided by its role and status in Users & roles. `dataNote`
 * says so on every band, so an editor looking for a name is sent to the right
 * screen rather than left hunting through this one.
 *
 * THE DESKS
 *
 * One section per desk, keyed by the desk itself (`lib/agents/desk.ts`). The
 * section supplies the words; which advisors sit under it stays in code, where
 * `deskForTitle` derives it from the advisor's title. They are NOT locked —
 * the page renders them in document order, so reordering or hiding a desk does
 * what the switch says, the same posture `/partners` takes with its groups. A
 * desk with nobody on it drops out on its own, switched on or not.
 *
 * Their English defaults are `DESK_LABEL` / `DESK_INTRO`, imported rather than
 * retyped, so the words that have always been the desks' have one home.
 *
 * Every English `defaults` value is the literal the page rendered before this
 * change, verbatim — including a headline that says "Twelve" and a WhatsApp
 * message that names the old domain. Correcting either is an editorial call
 * the client can now make in the CMS without a deploy; changing them here
 * would have been a copy edit smuggled into a plumbing change.
 *
 * THE ARABIC
 *
 * Hand-declared beside each English sibling, as `developer-page.ts` and
 * `property-page.ts` do. The eyebrow keeps the catalogue's `فريقنا`, which is
 * what `/ar/agents` already printed. The rest is a first draft in the sense of
 * ADR-0008, following the glossary (`lib/i18n/mt/glossary.ts`) — تملك حر,
 * على الخارطة — and writing money in Arabic prose as #490 settled. The client's
 * edit wins structurally: `mergeValues` never overwrites a twin that holds a
 * value.
 */
import type { MasterPageDef, SectionDef } from "../types";
import { text, area, eyebrow, body } from "../fields";
import {
  DESK_INTRO,
  DESK_LABEL,
  DESK_ORDER,
  type Desk,
} from "@/lib/agents/desk";
import { AGENT_TOKENS } from "../agent-page";

const NAME = AGENT_TOKENS.name;
const FIRST_NAME = AGENT_TOKENS.first_name;

const AGENTS_ADMIN = { label: "Agents & team", href: "/admin/agents" } as const;

/** The Arabic for each desk's heading and intro. English is `desk.ts`'s. */
const DESK_ARABIC: Record<Desk, { eyebrow: string; body: string }> = {
  leadership: {
    eyebrow: "القيادة",
    body: "الشركاء والمديرون العامّون. يتولّون الطلبات التي لا تندرج ضمن اختصاص مكتب واحد.",
  },
  "buy-side": {
    eyebrow: "مستشارو المشترين",
    body: "كبار المستشارين الذين يمثّلون المشترين في عقارات التملك الحر في أبوظبي. مستشار واحد، وطلب واحد، وتفاوض واحد.",
  },
  "off-plan": {
    eyebrow: "على الخارطة والاستثمار",
    body: "اختيار مشاريع على الخارطة وفق نماذج العائد، وإعداد أطروحات استثمارية لصفقات الاستحواذ التي تبدأ من مليوني درهم.",
  },
  lettings: {
    eyebrow: "مكتب الإيجارات والمستأجرين",
    body: "تمثيل المستأجرين، وإدارة أصول الملّاك، ومتابعة دورات تجديد العقود.",
  },
};

/** What files an advisor under each desk, said once per band. */
const DESK_RULE: Record<Desk, string> = {
  leadership:
    "Advisors whose title names them Managing Director, Partner, Founder or Principal.",
  "buy-side":
    "Every advisor whose title places them on no other desk — including one with no title at all.",
  "off-plan": "Advisors whose title mentions off-plan or investment.",
  lettings:
    "Advisors whose title mentions tenants, rentals, landlords or lettings.",
};

function deskSection(desk: Desk): SectionDef {
  return {
    key: desk,
    label: DESK_LABEL[desk],
    description: "The heading and intro above this desk's advisors.",
    dataNote: `${DESK_RULE[desk]} The cards are team records — name, title, portrait, specialties, languages and WhatsApp number — so they are edited in Agents & team. The desk drops out of the page on its own while nobody is on it.`,
    dataLink: AGENTS_ADMIN,
    fields: [
      eyebrow({ label: "Desk heading" }),
      body({ label: "Intro", max: 300 }),
    ],
    defaults: {
      eyebrow: DESK_LABEL[desk],
      eyebrow_ar: DESK_ARABIC[desk].eyebrow,
      body: DESK_INTRO[desk],
      body_ar: DESK_ARABIC[desk].body,
    },
  };
}

export const AGENTS_PAGE: MasterPageDef = {
  key: "agents",
  label: "Agents",
  path: "/agents",
  description:
    "The advisor team index. The advisors themselves are team records, edited in Agents & team; each one's own page is under Sub-pages → Agents.",
  sections: [
    {
      key: "hero",
      label: "Hero",
      description: "Eyebrow, two-line headline and standfirst at the top of the page.",
      locked: true,
      /*
       * Two headline fields rather than one with a newline in it. The page has
       * always broken this headline onto two lines, and a single-line input
       * cannot hold the break — so the second line gets its own box, and
       * leaving it blank ends the headline after the first.
       */
      fields: [
        eyebrow(),
        text("title", "Headline · first line", { max: 80 }),
        text("title_second", "Headline · second line", {
          max: 80,
          optional: true,
          help: "Set on its own line under the first. Leave blank for a one-line headline.",
        }),
        body({ key: "sub", label: "Standfirst", max: 400 }),
      ],
      defaults: {
        eyebrow: "Our team",
        eyebrow_ar: "فريقنا",
        title: "Twelve advisors.",
        title_ar: "اثنا عشر مستشاراً.",
        title_second: "By design.",
        title_second_ar: "عن قصد.",
        sub: "Bazar caps senior advisor headcount. Each advisor owns the relationship end-to-end — no junior handoffs, no fee-shares. When you engage Bazar, you engage a person.",
        sub_ar: "تضع بازار حدّاً لعدد كبار مستشاريها. يتولّى كل مستشار العلاقة من أولها إلى آخرها — لا تسليم لموظفين مبتدئين، ولا تقاسم للعمولات. حين تتعامل مع بازار، فأنت تتعامل مع شخص بعينه.",
      },
    },
    ...DESK_ORDER.map(deskSection),
    {
      key: "cards",
      label: "Advisor cards",
      description: "The WhatsApp badge on each advisor's portrait.",
      // Not a band — it is the wording every card shares — so there is nothing
      // to hide or move.
      locked: true,
      dataNote:
        "Everything else on a card is the advisor's own team record. The badge only appears when that record has a WhatsApp or phone number.",
      dataLink: AGENTS_ADMIN,
      fields: [
        area("whatsapp_message", "WhatsApp message", {
          max: 300,
          optional: false,
          help: `The message WhatsApp opens already holding when a visitor taps the badge. Use ${NAME} for the advisor's full name or ${FIRST_NAME} for their first name.`,
        }),
      ],
      defaults: {
        whatsapp_message: `Hi ${NAME}, found you on bazar.ae`,
        whatsapp_message_ar: `مرحباً ${NAME}، وجدتك على bazar.ae`,
      },
    },
  ],
};

/** The tokens `/agents` fills — one list for the renderer and the save check. */
export const AGENTS_PAGE_TOKENS: readonly string[] = Object.values(AGENT_TOKENS);
