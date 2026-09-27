/**
 * Where an enquiry came from, in the words the desk uses.
 *
 * `enquiries.source` cannot answer that on its own. Half the public forms file
 * as `contact_page` — the Buy and Rent heroes, the home page's owner card, the
 * off-plan interest form, the QR card among them — and only one of those is on
 * the contact page, so the inbox said "via contact page" for leads whose sender
 * never saw it. Two better facts already exist and were never read back:
 *
 *   - the form key (`enquiries.form_key`, 0128; and on every row of the
 *     submission log since 0094), which names the box;
 *   - the submission's `source_path`, which names the exact page it sat on,
 *     slug and locale prefix included — which project, which area guide,
 *     which campaign page, and whether the visitor was on the Arabic site.
 *
 * Pure: no I/O and no request scope. The pages read the rows; this decides
 * what they say.
 */

import { getFormDef } from "@/lib/forms/registry";
import type { FormDef } from "@/lib/forms/types";
import { MASTER_PAGES } from "@/lib/master-pages";
import { DEFAULT_LOCALE, isKnownLocale, type Locale } from "@/lib/i18n/locales";
import { extractReferenceFromSlug } from "@/lib/queries/property-utils";
import type { ENQUIRY_SOURCES } from "@/lib/schemas/enquiry";

type EnquirySource = (typeof ENQUIRY_SOURCES)[number];

/**
 * `enquiries.source`, for a person.
 *
 * Only the fallback now — a lead that names its form is described by the form.
 * `contact_page` reads "Website form" rather than "Contact page" because it is
 * the catch-all most forms file under; calling it the contact page is exactly
 * the mislabel this module exists to stop.
 */
export const SOURCE_LABELS: Record<EnquirySource, string> = {
  property_page: "Listing page",
  contact_page: "Website form",
  concierge: "AI concierge",
  valuation: "Valuation tool",
  mortgage: "Mortgage calculator",
  blog_cta: "Insights article",
  agent_page: "Advisor profile",
  share_with_advisor: "Shared with an advisor",
  whatsapp_inbound: "WhatsApp",
  brochure: "Brochure request",
  development_interest: "Project interest",
  list_property: "Owner listing",
  property_management: "Property management",
  property_consultation: "Consultation",
};

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source as EnquirySource] ?? humanise(source);
}

/** "saadiyat-lagoons" → "Saadiyat Lagoons"; "hotel_apartment" → "Hotel Apartment". */
export function humanise(value: string): string {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// ── the form ─────────────────────────────────────────────────────────────

export type EnquiryOrigin = {
  /** The page family the form belongs to — "Buy", "Project page", "Contact". */
  surface: string;
  /** The form's own name, or null when the lead came through no form. */
  form: string | null;
  /** The registry definition, when the key still names one. */
  def: FormDef | null;
  /**
   * False only for the channels that never involve a form. A web lead with
   * no key still came through one — which one just wasn't recorded.
   */
  viaForm: boolean;
};

/** Sources a person reaches without filling anything in. */
const NON_FORM_SOURCES: ReadonlySet<string> = new Set([
  "whatsapp_inbound",
  "concierge",
  "share_with_advisor",
]);

/**
 * One line of provenance for a list row: the form, or failing that the source.
 *
 * A key the registry no longer knows — a form renamed or retired since — is
 * still shown rather than dropped. It is the only record of which box the lead
 * used, and "Website form" would claim less than we know.
 */
export function enquiryOrigin(
  formKey: string | null,
  source: string,
): EnquiryOrigin {
  const def = formKey ? getFormDef(formKey) : null;
  if (def) return { surface: def.surface, form: def.name, def, viaForm: true };
  return {
    surface: sourceLabel(source),
    form: formKey ? humanise(formKey) : null,
    def: null,
    viaForm: Boolean(formKey) || !NON_FORM_SOURCES.has(source),
  };
}

/** `enquiryOrigin` without the definition — small enough to hand a client component. */
export type OriginLabel = Pick<EnquiryOrigin, "surface" | "form">;

export function originLabel(formKey: string | null, source: string): OriginLabel {
  const { surface, form } = enquiryOrigin(formKey, source);
  return { surface, form };
}

// ── the page ─────────────────────────────────────────────────────────────

export type SourcePage = {
  /** What kind of page, in the desk's words: "Listing", "Project page", "Buy". */
  kind: string;
  /** Which one, when the page is one of many — the listing, the project, the area. */
  name: string | null;
  /**
   * The path exactly as recorded, locale prefix included, so the link opens
   * what the visitor was looking at rather than its English twin.
   */
  href: string;
  /** The path without its locale prefix. */
  path: string;
  locale: Locale;
  /** Where staff edit that page, when one screen owns it. */
  edit: { href: string; label: string } | null;
};

/** What the enquiry row already knows, used to name the page it points at. */
export type SourcePageHints = {
  property?: { id: string; reference: string; title: string } | null;
  development?: { name: string; slug: string } | null;
};

/** The four marketing modes whose search results live at `/<mode>/search`. */
const SEARCH_MODES = new Set(["buy", "rent", "off-plan", "commercial"]);

/**
 * Split a recorded path into its locale and the page underneath.
 *
 * Compared by whole segment: `/areas` must not read as the Arabic prefix
 * followed by "eas" — the same prefix-versus-segment mistake that once made
 * `Disallow: /ar` block every area guide.
 */
export function splitLocale(recorded: string): { locale: Locale; path: string } {
  const bare = (recorded.split(/[?#]/)[0] ?? "").trim();
  const segments = bare.split("/").filter(Boolean);
  let locale: Locale = DEFAULT_LOCALE;
  if (segments[0] && isKnownLocale(segments[0])) {
    locale = segments[0];
    segments.shift();
  }
  return { locale, path: `/${segments.join("/")}` };
}

/**
 * Name the page a submission was sent from.
 *
 * Returns null when nothing usable was recorded — a blank, or a value that
 * isn't a path at all (the newsletter action files its signup source there,
 * `newsletter:insights_header`). Every real path gets an answer: a page this
 * doesn't recognise is still "a page at this address", which beats pretending
 * it wasn't recorded.
 */
export function describeSourcePage(
  recorded: string | null | undefined,
  hints: SourcePageHints = {},
): SourcePage | null {
  if (!recorded || !recorded.trim().startsWith("/")) return null;
  const { locale, path } = splitLocale(recorded);
  const href = locale === DEFAULT_LOCALE ? path : recordedHref(recorded);
  const page = (
    kind: string,
    name: string | null,
    edit: SourcePage["edit"],
  ): SourcePage => ({ kind, name, href, path, locale, edit });

  const master = MASTER_PAGES.find((p) => p.path === path);
  if (master) {
    return page(master.label, null, {
      href: `/admin/pages/master/${master.key}`,
      label: "Edit page",
    });
  }

  const [head, slug, ...rest] = path.split("/").filter(Boolean);
  if (!head) return page("Page", null, null);

  if (head === "p" && slug) {
    // Listing URLs are `/p/<slug>-<reference>`, so the enquiry's own listing is
    // recognisable from the address alone and a stale hint can't mislabel it.
    const own =
      hints.property &&
      slug.toLowerCase().endsWith(hints.property.reference.toLowerCase())
        ? hints.property
        : null;
    return page(
      "Listing",
      own
        ? `${own.reference} · ${own.title}`
        : (extractReferenceFromSlug(slug) ?? humanise(slug)),
      own ? { href: `/admin/properties/${own.id}`, label: "Edit listing" } : null,
    );
  }

  if (head === "developments" && slug) {
    const name =
      hints.development?.slug === slug ? hints.development.name : humanise(slug);
    return page("Project page", name, {
      href: `/admin/pages/sub/development/${slug}`,
      label: "Edit project page",
    });
  }

  if (head === "areas" && slug) {
    return page("Area guide", humanise(slug), {
      href: `/admin/pages/sub/area/${slug}`,
      label: "Edit area guide",
    });
  }

  if (head === "developers" && slug) {
    return page("Developer profile", humanise(slug), {
      href: `/admin/developers/${slug}`,
      label: "Edit developer",
    });
  }

  if (head === "agents" && slug) {
    return page("Advisor profile", humanise(slug), {
      href: `/admin/pages/sub/agent/${slug}`,
      label: "Edit profile page",
    });
  }

  if (head === "lp" && slug) {
    // Campaign pages are keyed by id in the builder, and naming the page here
    // would cost a read per enquiry. The slug is the page's name in practice.
    return page("Campaign landing page", humanise(slug), {
      href: "/admin/page-builder",
      label: "Open Page Builder",
    });
  }

  if (SEARCH_MODES.has(head) && slug === "search") {
    const mode = MASTER_PAGES.find((p) => p.path === `/${head}`);
    return page("Search results", mode?.label ?? humanise(head), {
      href: "/admin/pages/sub/search",
      label: "Edit search headers",
    });
  }

  if (head === "insights") {
    const last = rest.length > 0 ? rest[rest.length - 1]! : slug;
    return page("Insights", last ? humanise(last) : null, null);
  }

  if (head === "tools" && slug) {
    return page(`${humanise(slug)} tool`, null, null);
  }

  if (head === "pages" && slug) {
    return page("Page", humanise(slug), null);
  }

  return page("Page", null, null);
}

/** The recorded path with any query or fragment dropped, prefix kept. */
function recordedHref(recorded: string): string {
  const bare = (recorded.split(/[?#]/)[0] ?? "").trim();
  return bare.length > 1 ? bare.replace(/\/+$/, "") : bare;
}
