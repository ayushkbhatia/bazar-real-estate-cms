/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";
import { getPublishedArticleBySlug } from "@/lib/queries/articles";
import { ARTICLE_CATEGORY_LABELS } from "@/lib/schemas/article";
import { mediaPublicUrl } from "@/lib/media";

export const runtime = "edge";
export const alt = "Bazar insights article";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Sprint 5d (backfilled): composed OG image for insights articles.
 */
export default async function ArticleOpenGraph({
  params,
}: {
  params: { slug: string };
}) {
  const article = await getPublishedArticleBySlug(params.slug);

  const title = article?.title ?? "The Bazar Brief";
  const category = article
    ? ARTICLE_CATEGORY_LABELS[article.category]
    : "Insights";
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
            <div>
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
              <span>{authorName} · The Bazar Brief</span>
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
                  "linear-gradient(135deg, #4a6c4a 0%, #13110f 100%)",
              }}
            />
          )}
        </div>
      </div>
    ),
    { ...size },
  );
}
