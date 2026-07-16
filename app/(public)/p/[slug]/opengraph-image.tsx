import { ImageResponse } from "next/og";
import {
  extractReferenceFromSlug,
  formatPriceAED,
  getPublishedPropertyByReference,
} from "@/lib/queries/properties";
import { mediaPublicUrl } from "@/lib/media";

export const runtime = "edge";
export const alt = "Bazar property listing";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Sprint 4c (backfilled): composed OG image for property detail pages.
 * Renders a 1200×630 card with the hero on the left, listing metadata
 * on the right, brand wordmark + ORN footer.
 */
export default async function PropertyOpenGraph({
  params,
}: {
  params: { slug: string };
}) {
  const ref = extractReferenceFromSlug(params.slug);
  const property = ref ? await getPublishedPropertyByReference(ref) : null;

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
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: "#13110f",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ width: 540, height: 630, position: "relative" }}>
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
                background:
                  "linear-gradient(135deg, #2b5640 0%, #13110f 100%)",
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
          <div>
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
              {area}
              {property?.reference ? ` · ${property.reference}` : ""}
            </div>
          </div>
          <div>
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
            {(beds || baths || ft2) ? (
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
      </div>
    ),
    {
      ...size,
    },
  );
}
