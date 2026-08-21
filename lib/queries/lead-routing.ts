/**
 * Owner-lead routing for /services/sell.
 *
 * Two jobs:
 *   1. the areas index the location field autocompletes against, and
 *   2. the advisor match — which named advisor a lead is handed to.
 *
 * Coverage lives in `lib/seeds/agents.ts` (`areas: string[]`), because `staff`
 * has no coverage column: the DB row carries the identity (name, title, BRN,
 * user_id) and the seed carries the patch and the direct line. So the match is
 * a join on `slug` between the two. An advisor with no seed entry is still a
 * candidate for nothing — they cover nothing until someone says they do — and a
 * lead in an uncovered area stays unassigned so the desk triages it rather than
 * landing on a random advisor's list.
 */
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { localiseRow } from "@/lib/i18n/localise";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locales";
import { SEED_AGENTS } from "@/lib/seeds/agents";
import { listAgents } from "@/lib/queries/agents";
import { getPublicSiteSettings } from "@/lib/queries/site-settings";
import { UUID_SHAPE_RE } from "@/lib/uuid";

export type LeadAreaOption = {
  slug: string;
  name: string;
  /** The area a sub-community sits in — the routing key. Null for top areas. */
  parentSlug: string | null;
  /** Right-hand context in the suggestion row ("Abu Dhabi", "Saadiyat Island"). */
  context: string;
};

/**
 * The context shown beside a top-level area, and the one string here that is
 * not a row. It folds through the same store as everything else — the entry
 * exists ("Abu Dhabi" → "أبوظبي") — so it does not need its own catalogue key.
 */
const DEFAULT_CONTEXT = "Abu Dhabi";

/**
 * Rendered when Supabase isn't configured (local preview, e2e without creds) so
 * the field still autocompletes. Mirrors the seeded areas table.
 */
const FALLBACK_AREAS: LeadAreaOption[] = [
  "Saadiyat Island",
  "Al Reem Island",
  "Yas Island",
  "Al Raha",
  "Hudayriyat Island",
  "Masdar City",
  "Al Ghadeer",
  "Zayed City",
  "Khalifa City",
  "Corniche",
  "Al Maryah Island",
  "Jubail Island",
].map((name) => ({
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
  name,
  parentSlug: null,
  context: DEFAULT_CONTEXT,
}));

/**
 * Areas and sub-communities, for the location combobox. Buildings are excluded:
 * the index is a routing aid, and an owner typing their tower name still gets
 * through as free text.
 *
 * **The locale is a parameter, and it must stay one.** `matchAdvisor` below
 * calls this from a Server Action, where next-intl's `requestLocale` is
 * undefined — so an ambient `currentLocale()` read would answer `en` there and
 * `ar` on the page, silently, which is the trap docs/I18N.md describes for
 * route handlers. Routing wants the English index (it matches free text against
 * `name`, and `normalise` keeps only `a-z0-9`); a page wants the visitor's. The
 * default is English so every existing caller keeps the index it was written
 * against, and only a renderer asks for anything else.
 */
export async function listLeadAreaOptions(
  locale: Locale = DEFAULT_LOCALE,
): Promise<LeadAreaOption[]> {
  if (!isSupabaseConfigured) return FALLBACK_AREAS;
  try {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase
      .from("areas")
      .select("id, slug, name, name_ar, kind, parent_id")
      .in("kind", ["area", "sub_community"])
      .order("name", { ascending: true });
    if (error || !data || data.length === 0) return FALLBACK_AREAS;

    // `slug` and `parentSlug` are identity and never fold — an Arabic slug
    // resolves to no area at all, which is the failure docs/I18N.md warns is
    // invisible to an Arabic proofreader. Only `name` and `context` are read.
    const fold = (row: { name: string; name_ar?: string | null }) =>
      (
        localiseRow(row as unknown as Record<string, unknown>, locale) as {
          name: string;
        }
      ).name;

    const byId = new Map(data.map((r) => [r.id, r]));
    return data.map((r) => {
      const parent = r.parent_id ? byId.get(r.parent_id) : null;
      return {
        slug: r.slug,
        name: fold(r),
        parentSlug: parent ? parent.slug : null,
        // `name_ar: null` is load-bearing, not tidiness: `localiseRow` only
        // asks the store for a column whose twin KEY is present, so that it
        // cannot swap a slug or a price for a coincidental store hit. Passing
        // `{ name }` alone leaves this in English.
        context: parent
          ? fold(parent)
          : fold({ name: DEFAULT_CONTEXT, name_ar: null }),
      };
    });
  } catch {
    return FALLBACK_AREAS;
  }
}

/**
 * Free text → the area slugs to route on, most specific first. The owner may
 * have typed a building ("Mamsha, Saadiyat"), so this is a containment match
 * against the index rather than an equality check, longest name first so
 * "Saadiyat Lagoons" wins over "Saadiyat Island".
 *
 * Callers should hand this the ENGLISH index — `listLeadAreaOptions()` with no
 * argument — because `normalise` keeps only `a-z0-9`. An Arabic name normalises
 * to the empty string, and `"anything".includes("")` is true, so a folded index
 * would match the first option for any input at all. The empty-needle guard
 * below makes that a miss rather than a misroute, but it is a backstop, not the
 * contract: an Arabic index simply cannot answer a containment question here.
 */
export function resolveAreaSlugs(
  location: string,
  options: LeadAreaOption[],
  pickedSlug?: string | null,
): string[] {
  const picked = pickedSlug
    ? options.find((o) => o.slug === pickedSlug)
    : undefined;
  const typed = normalise(location);
  const match =
    picked ??
    [...options]
      .sort((a, b) => b.name.length - a.name.length)
      .find((o) => {
        const name = normalise(o.name);
        return name.length > 0 && typed.includes(name);
      });
  if (!match) return [];
  return match.parentSlug ? [match.slug, match.parentSlug] : [match.slug];
}

function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type AdvisorCandidate = {
  slug: string;
  displayName: string;
  title: string | null;
  brn: string | null;
  /** Real `staff.user_id` when the advisor exists in the DB, else null. */
  userId: string | null;
  specialties: string[];
  /** Area slugs this advisor covers, from the seed roster. */
  areas: string[];
  phone: string | null;
};

export type MatchedAdvisor = {
  slug: string;
  displayName: string;
  title: string | null;
  brn: string | null;
  initials: string;
  phone: string | null;
  /** Null when the advisor has no `staff` row, so nothing gets assigned. */
  assignableUserId: string | null;
};

const RENTAL_DESK_RE = /rent|letting|tenant|landlord/i;

/** "Senior" outranks "Associate"; everything else sorts behind both. */
function seniority(candidate: AdvisorCandidate): number {
  const title = candidate.title ?? "";
  if (/senior/i.test(title)) return 0;
  if (/associate/i.test(title)) return 1;
  return 2;
}

function isRentalDesk(candidate: AdvisorCandidate): boolean {
  return (
    RENTAL_DESK_RE.test(candidate.title ?? "") ||
    candidate.specialties.some((s) => RENTAL_DESK_RE.test(s))
  );
}

/**
 * Deterministic — no round-robin, no randomness. The same property in the same
 * community always routes to the same advisor, which is the promise the page
 * makes ("the senior Bazar advisor who covers your community").
 */
export function pickAdvisor(
  candidates: AdvisorCandidate[],
  opts: { areaSlugs: string[]; intent: "sell" | "rent_out" },
): AdvisorCandidate | null {
  if (opts.areaSlugs.length === 0) return null;
  const covering = candidates.filter((c) =>
    opts.areaSlugs.some((slug) => c.areas.includes(slug)),
  );
  if (covering.length === 0) return null;

  // Prefer the lettings desk for a letting, and keep it clear of a sale.
  const wantsRentalDesk = opts.intent === "rent_out";
  const preferred = covering.filter((c) => isRentalDesk(c) === wantsRentalDesk);
  const pool = preferred.length > 0 ? preferred : covering;

  return [...pool].sort((a, b) => {
    // Coverage of the exact community beats coverage of its parent area.
    const aDepth = opts.areaSlugs.findIndex((s) => a.areas.includes(s));
    const bDepth = opts.areaSlugs.findIndex((s) => b.areas.includes(s));
    if (aDepth !== bDepth) return aDepth - bDepth;
    const rank = seniority(a) - seniority(b);
    if (rank !== 0) return rank;
    return a.slug.localeCompare(b.slug);
  })[0];
}

export function toInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "BZ";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

/**
 * The roster the matcher runs against: `staff` for identity, the seed roster
 * for coverage and the direct line, joined on slug.
 */
export async function listAdvisorCandidates(): Promise<AdvisorCandidate[]> {
  const agents = await listAgents();
  const seedBySlug = new Map(SEED_AGENTS.map((s) => [s.slug, s]));
  return agents.map((a) => {
    const seed = seedBySlug.get(a.slug);
    return {
      slug: a.slug,
      displayName: a.display_name,
      title: a.title,
      brn: a.brn,
      userId: UUID_SHAPE_RE.test(a.user_id) ? a.user_id : null,
      specialties: a.specialties,
      areas: seed?.areas ?? [],
      phone: seed?.phone ?? null,
    };
  });
}

/**
 * The advisor match behind step 3, in precedence order:
 *
 *   1. the CMS routing rules (`site_settings.lead_routing.rules`) — an
 *      area→agent table an admin maintains at /admin/settings/routing, and the
 *      only source a non-engineer can change;
 *   2. the seed coverage roster, for areas no rule names;
 *   3. the CMS fallback agent.
 *
 * Returns null when all three come up empty — the confirmation then names the
 * desk rather than inventing a person, and the enquiry stays unassigned so it
 * surfaces in the admin's "Unassigned" queue instead of sitting on a random
 * advisor's list.
 */
export async function matchAdvisor(opts: {
  location: string;
  areaSlug?: string | null;
  intent: "sell" | "rent_out";
}): Promise<MatchedAdvisor | null> {
  const [areas, candidates, settings] = await Promise.all([
    listLeadAreaOptions(),
    listAdvisorCandidates(),
    getPublicSiteSettings(),
  ]);
  const areaSlugs = resolveAreaSlugs(opts.location, areas, opts.areaSlug);
  const routing = settings.lead_routing;

  const byUserId = (id: string | null | undefined) =>
    id ? (candidates.find((c) => c.userId === id) ?? null) : null;

  // Rules are evaluated in the order the admin wrote them; the most specific
  // area slug we resolved wins over its parent.
  let picked: AdvisorCandidate | null = null;
  for (const slug of areaSlugs) {
    const rule = routing.rules.find((r) => r.area_slug === slug);
    const candidate = byUserId(rule?.agent_id);
    if (candidate) {
      picked = candidate;
      break;
    }
  }

  picked ??= pickAdvisor(candidates, { areaSlugs, intent: opts.intent });
  picked ??= byUserId(routing.fallback_agent_id);

  if (!picked) return null;
  return {
    slug: picked.slug,
    displayName: picked.displayName,
    title: picked.title,
    brn: picked.brn,
    initials: toInitials(picked.displayName),
    phone: picked.phone,
    assignableUserId: picked.userId,
  };
}
