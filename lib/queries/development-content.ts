import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { currentLocale } from "@/lib/i18n/current";
import { localiseDeep } from "@/lib/i18n/localise";
import { mediaPublicUrl } from "@/lib/media";
import type { DevelopmentIndexRow } from "@/lib/queries/developments";
import { localiseRow } from "@/lib/i18n/localise";

/**
 * Reads for the parts of a project page an editor curates on the record:
 * the neighbouring projects it points at, and the advisor in its banner.
 */

const NEIGHBOUR_FIELDS =
  "id, name, name_ar, slug, status, handover_date, total_units, starting_price, tagline, tagline_ar, bedrooms_text, bedrooms_text_ar, description, description_ar, published_at, developers:developer_id(name, slug), areas:area_id(name, slug), hero:hero_image_id(storage_key, filename, alt_text, alt_text_ar)";

/**
 * Curated neighbours, in the order they were picked.
 *
 * Unpublished or deleted picks simply don't come back, so a project that was
 * pulled from the site stops appearing next to its neighbours rather than
 * rendering a card that leads nowhere.
 */
export async function listDevelopmentsByIds(
  ids: string[],
): Promise<DevelopmentIndexRow[]> {
  if (!isSupabaseConfigured || ids.length === 0) return [];
  try {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase
      .from("developments")
      .select(NEIGHBOUR_FIELDS)
      .in("id", ids.slice(0, 3))
      .not("published_at", "is", null);
    if (error || !data) return [];

    // A cast, not a shaper — the row goes out as-is, so an unfolded twin would
    // leak `name_ar` to the renderer as well as rendering English on /ar.
    // `localiseDeep` rather than `localiseRow`, because the alt text is one
    // level down inside the `hero` join.
    const rows = localiseDeep(
      data as unknown as Record<string, unknown>[],
      await currentLocale(),
    ) as unknown as DevelopmentIndexRow[];
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids
      .map((id) => byId.get(id))
      .filter((r): r is DevelopmentIndexRow => r !== undefined);
  } catch (error) {
    console.error("[listDevelopmentsByIds]", error);
    return [];
  }
}

export type ProjectAdvisor = {
  user_id: string;
  slug: string;
  display_name: string;
  title: string | null;
  brn: string | null;
  bio: string | null;
  photo_url: string | null;
  /** Publishable contact details (0077). Null until staff fill them in. */
  email: string | null;
  phone: string | null;
  /** Falls back to `phone` when the WhatsApp field is blank. */
  whatsapp: string | null;
};

/*
 * The `_ar` twins were absent from this select, so there was nothing for a
 * fold to fold and the advisor band on every /ar project page published an
 * English name and title. Selecting them is half the fix; `localiseRow` below
 * is the other half — the same pair of mistakes `getDeveloperBySlug`
 * documents from the other side.
 *
 * `public_phone` and `whatsapp` are 0077's columns, and #529 added them here
 * because leaving them out is why the two buttons under the photograph
 * dialled `+97125550001` and messaged `+971501234567` — the placeholder
 * numbers on `SEED_AGENTS[0]`, which the spread supplied for every field this
 * select did not ask for. `public_email` and `photo_url` are the last two
 * that spread was still answering: the email went straight to the floating
 * CTA rail as `mariam@bazar.ae`, and the photo came from a second query
 * (`withAgentPhoto`) that this one can do itself.
 */
const ADVISOR_FIELDS =
  "user_id, display_name, display_name_ar, slug, title, title_ar, brn, bio, bio_ar, photo_url, public_email, public_phone, whatsapp, status";

function blankToNull(v: unknown): string | null {
  const t = typeof v === "string" ? v.trim() : "";
  return t === "" ? null : t;
}

/**
 * The advisor chosen for a project's banner.
 *
 * Returns `null` when nobody is assigned, or when the assigned advisor is no
 * longer publishable — the `staff_public_agents` policy (0036) hands rows to
 * `anon` only while `role = 'agent' and status = 'active'`. The caller then
 * drops the banner.
 *
 * It used to answer with a `SeedAgent`, spreading `SEED_AGENTS[0]` underneath
 * the row to satisfy a shape carrying fields `staff` has no column for. #529
 * emptied that spread of everything that mattered by selecting the real
 * columns instead; this removes it, and with it the last two fields it was
 * still answering. Nothing is substituted for an advisor now: a missing band
 * is the honest failure, and the same one `getAdvisorByUserId` already
 * chooses for listings.
 */
export async function getAdvisorForBanner(
  userId: string,
): Promise<ProjectAdvisor | null> {
  if (!isSupabaseConfigured || !userId) return null;
  try {
    const supabase = createSupabasePublicClient();
    const { data: raw } = await supabase
      .from("staff")
      .select(ADVISOR_FIELDS)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (!raw) return null;
    const data = localiseRow(
      raw as unknown as Record<string, unknown>,
      await currentLocale(),
    ) as unknown as typeof raw;

    /*
     * The blank-to-null step matters for the two phone numbers: an empty
     * string in the column is not an answer, and `data.whatsapp ?? phone`
     * would take it as one and render a `wa.me/` link to nowhere. WhatsApp
     * falls back to the phone and then to nothing, which is the rule
     * `getAdvisorByUserId` already applies on the listing page.
     */
    const phone = blankToNull(data.public_phone);
    return {
      user_id: data.user_id,
      slug: data.slug ?? "",
      display_name: data.display_name,
      title: blankToNull(data.title),
      brn: blankToNull(data.brn),
      bio: blankToNull(data.bio),
      photo_url: blankToNull(data.photo_url),
      email: blankToNull(data.public_email),
      phone,
      whatsapp: blankToNull(data.whatsapp) ?? phone,
    };
  } catch (error) {
    console.error("[getAdvisorForBanner]", error);
    return null;
  }
}

/**
 * Resolve the media ids on curated feature blocks into public URLs. One query
 * for the whole page; a block whose asset has been trashed falls back to the
 * placeholder rather than rendering a broken image.
 */
export async function withFeatureImages(
  blocks: { media_id?: string | null }[] | undefined,
): Promise<Record<string, string>> {
  const ids = [
    ...new Set((blocks ?? []).map((b) => b.media_id).filter(Boolean)),
  ];
  if (!isSupabaseConfigured || ids.length === 0) return {};
  try {
    const supabase = createSupabasePublicClient();
    const { data } = await supabase
      .from("media_assets")
      .select("id, storage_key")
      .in("id", ids as string[])
      .is("deleted_at", null);
    return Object.fromEntries(
      (data ?? []).map((m) => [m.id, mediaPublicUrl(m.storage_key)]),
    );
  } catch (error) {
    console.error("[withFeatureImages]", error);
    return {};
  }
}
