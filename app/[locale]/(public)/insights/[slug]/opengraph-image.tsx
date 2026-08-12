import { ImageResponse } from "next/og";
import { getPublishedArticleBySlug } from "@/lib/queries/articles";
import { mediaPublicUrl } from "@/lib/media";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { withLocales } from "@/lib/i18n/static-params";

// English in both locales. Satori shapes Arabic but does not reorder it, and a
// bidi pre-pass breaks on the first line wrap, so an Arabic card reads
// backwards. Pinned by lib/og/arabic-og.test.ts, which carries the evidence.
export const alt = "Bazar insights article";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Same param set as the page this image belongs to. */
export async function generateStaticParams(): Promise<{ slug: string; locale: string }[]> {
  if (!isSupabaseConfigured) return [];
  try {
    const supabase = createSupabasePublicClient();
    const { data } = await supabase
      .from("articles")
      .select("slug")
      .eq("status", "published")
      .is("deleted_at", null)
      .limit(2000);
    return withLocales((data ?? []).map((a) => ({ slug: a.slug })));
  } catch (err) {
    console.error("[insights/[slug]/opengraph-image] generateStaticParams failed", err);
    return [];
  }
}

/**
 * Sprint 5d (backfilled): composed OG image for insights articles.
 *
 * `params` is a Promise in Next.js 16, exactly as in the sibling `page.tsx`.
 * It used to be typed as a plain object and read synchronously, which made
 * `params.slug` undefined: production served every article's share card as a
 * 200 with a zero-byte body. The route reads through the cookie-free client,
 * so it also no longer needs the edge runtime — which was the only reason it
 * could not be prerendered.
 */
export default async function ArticleOpenGraph({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getPublishedArticleBySlug(slug);

  const title = article?.title ?? "The Bazar Brief";
  const category = article?.category_label ?? "Insights";
  const authorName = article?.author?.display_name ?? "Bazar";
  const heroSrc = article?.hero
    ? mediaPublicUrl(article.hero.storage_key)
    : null;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "#f6f3ec",
          fontFamily: "system-ui, sans-serif",
          color: "#1a1a1a",
        }}
      >
        <div style={{ flex: 1, display: "flex" }}>
          <div
            style={{
              flex: 1,
              padding: "60px 56px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
            }}
          >
            {/* Satori requires an explicit `display` on any element with more
                than one child — without it `next/og` aborts mid-stream and the
                route answers 200 with a zero-byte body. */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  fontSize: 14,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  color: "#7a7568",
                }}
              >
                {category}
              </div>
              <div
                style={{
                  fontSize: 56,
                  lineHeight: 1.06,
                  marginTop: 28,
                  letterSpacing: -1.5,
                  fontFamily: "Georgia, serif",
                  fontWeight: 400,
                  maxWidth: 620,
                }}
              >
                {title}
              </div>
            </div>
            <div
              style={{
                marginTop: 28,
                display: "flex",
                justifyContent: "space-between",
                fontSize: 14,
                color: "#7a7568",
              }}
            >
              <span>{`${authorName} · The Bazar Brief`}</span>
              <span>bazar.ae</span>
            </div>
          </div>
          {heroSrc ? (
            <div
              style={{
                width: 420,
                height: "100%",
                position: "relative",
                display: "flex",
              }}
            >
              <img
                src={heroSrc}
                alt={title}
                width={420}
                height={630}
                style={{
                  objectFit: "cover",
                  width: 420,
                  height: 630,
                }}
              />
            </div>
          ) : (
            <div
              style={{
                width: 420,
                background:
                  "linear-gradient(135deg, #003452 0%, #13110f 100%)",
              }}
            />
          )}
        </div>
      </div>
    ),
    { ...size },
  );
}
