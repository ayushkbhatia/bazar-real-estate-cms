/**
 * Reads for the Cards screens (`lib/master-pages/cards.ts`).
 *
 * Admin-only, unlike the loaders it sits beside: these go through the
 * cookie-aware server client, because the override report reads every
 * project's document — drafts included — and the preview reads advisors who
 * may not be publishable yet. Nothing public imports this module.
 */
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  parseStoredSections,
  resolveSections,
  type SectionValues,
  type StoredSection,
} from "@/lib/master-pages";
import {
  cardPageDef,
  cardTextFields,
  findCardOverrides,
  type CardDef,
  type CardOverride,
  type CardSourceKey,
} from "@/lib/master-pages/cards";
import { developmentPageDef, subPageSlug } from "@/lib/master-pages/subpages";
import { developmentPageCopySlug } from "@/lib/queries/development-page";
import { propertyPageCopySlug } from "@/lib/queries/property-page";

/** The `pages.slug` a card's source document lives at. */
export function cardSourceSlug(source: CardSourceKey): string {
  return source === "development-copy"
    ? developmentPageCopySlug()
    : propertyPageCopySlug();
}

export type CardContent = {
  /** The card's section, resolved bilingually over the code defaults. */
  values: SectionValues;
  /** Whether anyone has saved wording into this section yet. */
  edited: boolean;
};

/**
 * The stored source document, or null. Never throws — a read that fails is
 * reported as nothing stored, which renders the shipped wording, the same
 * degradation every public loader makes.
 */
export async function readCardSource(
  source: CardSourceKey,
): Promise<{ id: string; stored: StoredSection[] | null } | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("pages")
      .select("id, blocks")
      .eq("slug", cardSourceSlug(source))
      .maybeSingle();
    if (error || !data) return null;
    return { id: data.id, stored: parseStoredSections(data.blocks) };
  } catch (error) {
    console.error(`[cards] failed to read ${source}`, error);
    return null;
  }
}

/** Resolve a card's section out of a stored document (or none). */
export function resolveCardValues(
  card: CardDef,
  stored: StoredSection[] | null,
): CardContent {
  const own = stored?.find((s) => s.key === card.sectionKey) ?? null;
  const [section] = resolveSections(
    cardPageDef(card),
    own ? [own] : null,
    "bilingual",
  );
  const edited = own
    ? Object.values(own.values).some(
        (v) => typeof v === "string" && v.trim() !== "",
      )
    : false;
  return { values: section.values, edited };
}

export async function getCardContent(card: CardDef): Promise<CardContent> {
  const doc = await readCardSource(card.source);
  return resolveCardValues(card, doc?.stored ?? null);
}

// ── Projects: the preview's sample data and the override report ────────────

/** An advisor as the banner draws them, in one language. */
export type CardAdvisor = {
  user_id: string;
  slug: string;
  display_name: string;
  title: string | null;
  photo_url: string | null;
  phone: string | null;
  whatsapp: string | null;
};

/** Every token a project card can carry, in one language, unisolated. */
export type CardProjectTokens = {
  name: string;
  area: string;
  developer: string;
  plan: string;
  advisor: string;
  advisor_first: string;
};

export type CardProject = {
  slug: string;
  name: string;
  published: boolean;
  tokens: { en: CardProjectTokens; ar: CardProjectTokens };
  advisor: { en: CardAdvisor; ar: CardAdvisor } | null;
  /** The project's own section values for this card, resolved bilingually. */
  values: SectionValues;
  /** The fields it overrides, compared against the card as SAVED. */
  overrides: CardOverride[];
};

type DevRow = {
  name: string;
  name_ar: string | null;
  slug: string;
  published_at: string | null;
  payment_plan: unknown;
  lead_advisor_id: string | null;
  developers: { name: string; name_ar: string | null } | null;
  areas: { name: string; name_ar: string | null } | null;
};

type StaffRow = {
  user_id: string;
  slug: string | null;
  display_name: string;
  display_name_ar: string | null;
  title: string | null;
  title_ar: string | null;
  photo_url: string | null;
  public_phone: string | null;
  whatsapp: string | null;
};

function nonBlank(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

function planName(plan: unknown, ar: boolean): string {
  if (!plan || typeof plan !== "object") return "";
  const p = plan as Record<string, unknown>;
  return (ar ? nonBlank(p.name_ar) : null) ?? nonBlank(p.name) ?? "";
}

function advisorIn(row: StaffRow, ar: boolean): CardAdvisor {
  const phone = nonBlank(row.public_phone);
  return {
    user_id: row.user_id,
    slug: row.slug ?? "",
    display_name:
      (ar ? nonBlank(row.display_name_ar) : null) ?? row.display_name,
    title: (ar ? nonBlank(row.title_ar) : null) ?? nonBlank(row.title),
    photo_url: nonBlank(row.photo_url),
    phone,
    whatsapp: nonBlank(row.whatsapp) ?? phone,
  };
}

function tokensIn(
  row: DevRow,
  advisor: CardAdvisor | null,
  ar: boolean,
): CardProjectTokens {
  const pick = (
    en: string | undefined | null,
    arv: string | null | undefined,
  ) => (ar ? nonBlank(arv) : null) ?? en ?? "";
  const advisorName = advisor?.display_name ?? "";
  return {
    name: pick(row.name, row.name_ar),
    area: pick(row.areas?.name, row.areas?.name_ar),
    developer: pick(row.developers?.name, row.developers?.name_ar),
    plan: planName(row.payment_plan, ar),
    advisor: advisorName,
    advisor_first: advisorName.split(" ")[0] ?? "",
  };
}

/**
 * Every project, with what the preview needs to draw its card and what its own
 * document overrides. Published projects first — they are the ones a visitor
 * can see — then alphabetical.
 *
 * Three reads for the whole catalogue (projects, their advisors, their
 * documents) rather than one per project.
 */
export async function listCardProjects(
  card: CardDef,
  cardValues: SectionValues,
): Promise<CardProject[]> {
  if (!isSupabaseConfigured || card.overriddenBy !== "development") return [];
  try {
    const supabase = await createSupabaseServerClient();
    const [{ data: devs }, { data: docs }] = await Promise.all([
      supabase
        .from("developments")
        .select(
          "name, name_ar, slug, published_at, payment_plan, lead_advisor_id, developers:developer_id(name, name_ar), areas:area_id(name, name_ar)",
        )
        .order("name", { ascending: true }),
      supabase
        .from("pages")
        .select("slug, blocks")
        .like("slug", `${subPageSlug("development", "")}%`),
    ]);
    const rows = (devs ?? []) as unknown as DevRow[];

    const advisorIds = [
      ...new Set(rows.map((r) => r.lead_advisor_id).filter(Boolean)),
    ] as string[];
    const { data: staff } = advisorIds.length
      ? await supabase
          .from("staff")
          .select(
            "user_id, slug, display_name, display_name_ar, title, title_ar, photo_url, public_phone, whatsapp",
          )
          .in("user_id", advisorIds)
      : { data: [] };
    const staffById = new Map(
      ((staff ?? []) as unknown as StaffRow[]).map((s) => [s.user_id, s]),
    );

    const prefix = subPageSlug("development", "");
    const docBySlug = new Map(
      (docs ?? []).map((d) => [d.slug.slice(prefix.length), d.blocks]),
    );
    const fields = cardTextFields(card);

    const projects = rows.map((row): CardProject => {
      const staffRow = row.lead_advisor_id
        ? staffById.get(row.lead_advisor_id)
        : undefined;
      const advisor = staffRow
        ? { en: advisorIn(staffRow, false), ar: advisorIn(staffRow, true) }
        : null;
      const stored = parseStoredSections(docBySlug.get(row.slug) ?? null);
      const own = resolveSections(
        developmentPageDef({ name: row.name, slug: row.slug }),
        stored,
        "bilingual",
      ).find((s) => s.key === card.sectionKey);
      const values = own?.values ?? {};
      return {
        slug: row.slug,
        name: row.name,
        published: row.published_at !== null,
        tokens: {
          en: tokensIn(row, advisor?.en ?? null, false),
          ar: tokensIn(row, advisor?.ar ?? null, true),
        },
        advisor,
        values,
        overrides: findCardOverrides(fields, cardValues, values),
      };
    });

    return projects.sort(
      (a, b) =>
        Number(b.published) - Number(a.published) ||
        a.name.localeCompare(b.name),
    );
  } catch (error) {
    console.error("[cards] failed to list projects", error);
    return [];
  }
}
