import type { ImageValue } from "@/lib/master-pages";

/**
 * A project has two pieces of cover art doing two different jobs.
 *
 * `developments.hero_image_id` — the "master" image — is composed for a card:
 * the development tile on `/off-plan`, the home page strip, the OG preview.
 * Those are all roughly 4:3 with the subject centred. The project page's hero
 * is a 640px-tall full-bleed band, so dropping the same file in there crops it
 * hard and reads as stretched.
 *
 * So the sub-page editor's Hero section carries its own `image` field, and the
 * page prefers it. Every existing project has that field empty, and the client
 * has a hundred-odd live pages — falling back to the master image keeps them
 * rendering exactly as they do today until someone uploads a wide crop.
 */
export function resolveHeroImage(input: {
  /** The Hero section's `image` field, with its URL already resolved. */
  banner: ImageValue | null;
  /** Public URL of the record's cover image, or null when it has none. */
  coverUrl: string | null;
  coverAlt: string | null;
  /** Project name — the last-resort alt text. */
  name: string;
}): { url: string | null; alt: string; source: "banner" | "cover" | "none" } {
  const bannerUrl = input.banner?.url?.trim();
  if (bannerUrl) {
    return {
      url: bannerUrl,
      alt: input.banner?.alt?.trim() || input.name,
      source: "banner",
    };
  }

  const coverUrl = input.coverUrl?.trim();
  if (coverUrl) {
    return {
      url: coverUrl,
      alt: input.coverAlt?.trim() || input.name,
      source: "cover",
    };
  }

  return { url: null, alt: input.name, source: "none" };
}
