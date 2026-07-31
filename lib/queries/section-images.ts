import { createSupabasePublicClient } from "@/lib/supabase/public";
import { mediaPublicUrl } from "@/lib/media";
import type { ImageValue, ResolvedSection } from "@/lib/master-pages";

/**
 * Turn every `media_id` in the resolved sections into a public URL. One query
 * for the whole page, walking both scalar image fields and image fields inside
 * list items.
 */
export async function attachImageUrls(sections: ResolvedSection[]): Promise<void> {
  const images: ImageValue[] = [];
  const collect = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }
    const v = value as Record<string, unknown>;
    if ("media_id" in v) {
      images.push(v as ImageValue);
      return;
    }
    Object.values(v).forEach(collect);
  };
  for (const section of sections) Object.values(section.values).forEach(collect);

  const ids = [...new Set(images.map((i) => i.media_id).filter(Boolean))];
  if (ids.length === 0) return;

  try {
    const supabase = createSupabasePublicClient();
    const { data } = await supabase
      .from("media_assets")
      .select("id, storage_key, mime_type")
      .in("id", ids as string[])
      .is("deleted_at", null);
    const byId = new Map((data ?? []).map((m) => [m.id, m]));
    for (const image of images) {
      const asset = image.media_id ? byId.get(image.media_id) : null;
      // A trashed or deleted asset falls back to the placeholder rather than
      // rendering a broken image.
      image.url = asset ? mediaPublicUrl(asset.storage_key) : null;
      image.mime = asset?.mime_type ?? null;
    }
  } catch (error) {
    console.error("[master-pages] failed to resolve image urls", error);
  }
}

