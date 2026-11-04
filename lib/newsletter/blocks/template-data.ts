import "server-only";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { mediaPublicUrl } from "@/lib/media";
import {
  launchTemplate,
  staticTemplate,
  type BuiltInTemplate,
  type LaunchProject,
  type SiteFooter,
  type TemplateDraft,
  type TemplatePicks,
} from "./templates";
import type { ImageValue } from "./types";

/**
 * What a built-in template is filled with, read live when it is used: the
 * site footer's socials, contact details and licence line (/admin/footer),
 * a project's own record for the launch, the newest listings and articles
 * for the others. Public client, published rows only — a newsletter can't
 * feature what the site doesn't show.
 */

type Row = Record<string, unknown>;
const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");

const NETWORKS: [RegExp, string][] = [
  [/insta/i, "instagram"],
  [/face|fb\b/i, "facebook"],
  [/tik ?tok/i, "tiktok"],
  [/you ?tube/i, "youtube"],
  [/linked ?in/i, "linkedin"],
  [/^x$|twitter/i, "x"],
  [/whats ?app/i, "whatsapp"],
];

export async function readSiteFooter(): Promise<SiteFooter> {
  const sb = createSupabasePublicClient();
  const [settings, socials, contact] = await Promise.all([
    sb.from("footer_settings").select("legal_line, legal_line_ar").limit(1).maybeSingle(),
    sb.from("footer_socials").select("label, href, is_visible, position").eq("is_visible", true).order("position"),
    sb.from("footer_contact_items").select("kind, body, body_ar, is_visible, position").eq("is_visible", true).order("position"),
  ]);
  const lines = (kind: string) =>
    ((contact.data ?? []) as Row[]).filter((c) => c.kind === kind).flatMap((c) => s(c.body).split("\n").map((l) => l.trim()).filter(Boolean));
  const phones = lines("phone");
  const address = ((contact.data ?? []) as Row[]).find((c) => c.kind === "address");
  return {
    socials: ((socials.data ?? []) as Row[])
      .map((r) => ({ network: NETWORKS.find(([re]) => re.test(s(r.label)))?.[1] ?? "website", url: s(r.href) }))
      .filter((r) => r.url),
    phone: phones[0] ?? "",
    // A UAE mobile among the numbers is the one WhatsApp reaches.
    whatsapp: phones.find((p) => /^\+?971\s*5/.test(p.replace(/[^\d+]/g, ""))) ?? "",
    email: lines("email")[0] ?? "",
    address: s(address?.body).replace(/\n+/g, ", "),
    address_ar: s(address?.body_ar).replace(/\n+/g, "، "),
    legal: s(settings.data?.legal_line),
    legal_ar: s(settings.data?.legal_line_ar),
  };
}

const image = (key: unknown, alt = ""): ImageValue | null => {
  const k = s(key);
  return k ? { url: mediaPublicUrl(k), key: k, alt } : null;
};

/** Published projects to launch, newest first — the launch template's picker. */
export async function launchableProjects(): Promise<{ id: string; name: string; area: string }[]> {
  const { data } = await createSupabasePublicClient()
    .from("developments")
    .select("id, name, area:areas(name)")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(100);
  return ((data ?? []) as Row[]).map((r) => ({
    id: String(r.id),
    name: s(r.name),
    area: s((r.area as Row | null)?.name),
  }));
}

function handover(date: unknown, locale: "en" | "ar"): string {
  const d = typeof date === "string" ? new Date(date) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  const quarter = Math.floor(d.getUTCMonth() / 3) + 1;
  return locale === "ar" ? `الربع ${quarter} ${d.getUTCFullYear()}` : `Q${quarter} ${d.getUTCFullYear()}`;
}

/** One project as the launch template reads it, or null when it isn't published. */
export async function readLaunchProject(id: string): Promise<LaunchProject | null> {
  const sb = createSupabasePublicClient();
  const { data } = await sb
    .from("developments")
    .select(
      "id, slug, name, name_ar, tagline, tagline_ar, bedrooms_text, bedrooms_text_ar, handover_date, amenities, amenities_ar, meta, hero:media_assets!developments_hero_image_id_fkey(storage_key, alt_text), area:areas(name, name_ar), developer:developers(name, name_ar)",
    )
    .eq("id", id)
    .not("published_at", "is", null)
    .maybeSingle();
  if (!data) return null;
  const r = data as unknown as Row;
  const blocks = Array.isArray((r.meta as Row | null)?.feature_blocks) ? (((r.meta as Row).feature_blocks as Row[]) ?? []) : [];
  const mediaIds = blocks.map((b) => s(b.media_id)).filter(Boolean);
  const { data: media } = mediaIds.length
    ? await sb.from("media_assets").select("id, storage_key").in("id", mediaIds).is("deleted_at", null)
    : { data: [] as Row[] };
  const keyOf = new Map(((media ?? []) as Row[]).map((m) => [String(m.id), s(m.storage_key)]));
  const name = s(r.name);
  const hero = r.hero as Row | null;
  return {
    id: String(r.id),
    slug: s(r.slug),
    name,
    name_ar: s(r.name_ar),
    area: s((r.area as Row | null)?.name),
    area_ar: s((r.area as Row | null)?.name_ar),
    developer: s((r.developer as Row | null)?.name),
    developer_ar: s((r.developer as Row | null)?.name_ar),
    tagline: s(r.tagline),
    tagline_ar: s(r.tagline_ar),
    bedrooms: s(r.bedrooms_text),
    bedrooms_ar: s(r.bedrooms_text_ar),
    handover: handover(r.handover_date, "en"),
    handover_ar: handover(r.handover_date, "ar"),
    hero: image(hero?.storage_key, s(hero?.alt_text) || name),
    features: blocks.map((b) => ({
      title: s(b.title),
      title_ar: s(b.title_ar),
      copy: s(b.copy),
      copy_ar: s(b.copy_ar),
      image: image(keyOf.get(s(b.media_id)), s(b.title)),
    })),
    amenities: Array.isArray(r.amenities) ? (r.amenities as unknown[]).map(s).filter(Boolean) : [],
    amenities_ar: Array.isArray(r.amenities_ar) ? (r.amenities_ar as unknown[]).map(s) : [],
  };
}

async function newest(): Promise<TemplatePicks> {
  const sb = createSupabasePublicClient();
  const [properties, articles] = await Promise.all([
    sb
      .from("properties")
      .select("id")
      .eq("status", "published")
      .is("deleted_at", null)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(4),
    sb
      .from("articles")
      .select("id")
      .eq("status", "published")
      .is("deleted_at", null)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(3),
  ]);
  return {
    property: (properties.data ?? []).map((r) => String(r.id)),
    development: [],
    article: (articles.data ?? []).map((r) => String(r.id)),
  };
}

/** A built-in template filled from the live site. Null when the launch's project isn't published. */
export async function builtInTemplateDraft(id: BuiltInTemplate, projectId?: string | null): Promise<TemplateDraft | null> {
  const site = await readSiteFooter();
  if (id === "launch") {
    const pick = projectId ?? (await launchableProjects())[0]?.id;
    const project = pick ? await readLaunchProject(pick) : null;
    return project ? launchTemplate(project, site) : null;
  }
  return staticTemplate(id, site, await newest());
}
