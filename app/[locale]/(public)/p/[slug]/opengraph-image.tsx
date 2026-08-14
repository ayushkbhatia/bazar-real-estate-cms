import { ImageResponse } from "next/og";
import { DEFAULT_LOCALE } from "@/lib/i18n/locales";
import {
  extractReferenceFromSlug,
  formatPriceAED,
  getPublishedPropertyByReference,
  propertyUrl,
} from "@/lib/queries/properties";
import { mediaPublicUrl } from "@/lib/media";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { withLocales } from "@/lib/i18n/static-params";

// English in both locales. Satori shapes Arabic but does not reorder it, and a
// bidi pre-pass breaks on the first line wrap, so an Arabic card reads
// backwards. Pinned by lib/og/arabic-og.test.ts, which carries the evidence.
export const alt = "Bazar property listing";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Same param set as the page this image belongs to. */
export async function generateStaticParams(): Promise<
  { slug: string; locale: string }[]
> {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = createSupabasePublicClient();
    const { data } = await supabase
      .from("properties")
      .select("slug, reference")
      .eq("status", "published")
      .is("deleted_at", null)
      .limit(5000);
    return withLocales(
      (data ?? []).map((p) => ({ slug: propertyUrl(p).replace("/p/", "") })),
    );
  } catch (err) {
    console.error(
      "[p/[slug]/opengraph-image] generateStaticParams failed",
      err,
    );
    return [];
  }
}

/**
 * Sprint 4c (backfilled): composed OG image for property detail pages.
 * Renders a 1200×630 card with the hero on the left, listing metadata
 * on the right, brand wordmark + ORN footer.
 *
 * `params` is a Promise in Next.js 16, exactly as in the sibling `page.tsx`.
 * It used to be typed as a plain object and read synchronously, so
 * `extractReferenceFromSlug(undefined)` threw and this route answered 500 in
 * production. The listing page overrides `openGraph.images` with the property
 * hero, so the breakage was invisible in share previews — but the route is
 * reachable directly. The read is cookie-free, so the edge runtime is gone
 * too; it was the only thing keeping this route out of the prerender.
 */
export default async function PropertyOpenGraph({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ref = extractReferenceFromSlug(slug);
  // DEFAULT_LOCALE explicitly, matching the insights card. This is a metadata
  // route: it renders outside the layout tree, so there is no
  // `setRequestLocale` above it and an ambient locale read here is a dynamic
  // API that would drop this route off prerendering. The card is English by
  // decision anyway — Satori shapes Arabic but does not reorder it.
  const property = ref
    ? await getPublishedPropertyByReference(ref, DEFAULT_LOCALE)
    : null;

  const title = property?.title ?? "Bazar Real Estate";
  const area = property?.areas?.name ?? "Abu Dhabi";
  const price = property
    ? formatPriceAED(property.price_aed)
    : "Properly understood";
  const beds = property?.beds ?? null;
  const baths = property?.baths ?? null;
  const ft2 = property?.built_up_ft2 ?? null;
  const heroSrc = property?.hero
    ? mediaPublicUrl(property.hero.storage_key)
    : null;

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        background: "#13110f",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          width: 540,
          height: 630,
          position: "relative",
        }}
      >
        {heroSrc ? (
          <img
            src={heroSrc}
            alt={title}
            width={540}
            height={630}
            style={{ objectFit: "cover", width: 540, height: 630 }}
          />
        ) : (
          <div
            style={{
              width: 540,
              height: 630,
              background: "linear-gradient(135deg, #003452 0%, #13110f 100%)",
            }}
          />
        )}
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 56px",
          color: "#ffffff",
        }}
      >
        {/* Satori requires an explicit `display` on any element with more
              than one child — without it `next/og` aborts mid-stream and the
              route answers 500 rather than a PNG. */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 14,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.6)",
            }}
          >
            Bazar · Abu Dhabi
          </div>
          <div
            style={{
              fontSize: 48,
              lineHeight: 1.08,
              marginTop: 28,
              maxWidth: 540,
              letterSpacing: -1,
              fontWeight: 400,
              fontFamily: "Georgia, serif",
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 18,
              color: "rgba(255,255,255,0.75)",
              marginTop: 18,
            }}
          >
            {property?.reference ? `${area} · ${property.reference}` : area}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 44,
              fontFamily: "Georgia, serif",
              letterSpacing: -1,
              color: "#ffffff",
            }}
          >
            {price}
          </div>
          {beds || baths || ft2 ? (
            <div
              style={{
                fontSize: 16,
                color: "rgba(255,255,255,0.65)",
                marginTop: 12,
                display: "flex",
                gap: 16,
              }}
            >
              {beds ? <span>{beds} bd</span> : null}
              {baths ? <span>{baths} ba</span> : null}
              {ft2 ? <span>{ft2.toLocaleString()} ft²</span> : null}
            </div>
          ) : null}
          <div
            style={{
              marginTop: 32,
              paddingTop: 18,
              borderTop: "1px solid rgba(255,255,255,0.18)",
              fontSize: 12,
              color: "rgba(255,255,255,0.5)",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>bazar.ae</span>
            <span>ORN 28041 · Abu Dhabi</span>
          </div>
        </div>
      </div>
    </div>,
    {
      ...size,
    },
  );
}
