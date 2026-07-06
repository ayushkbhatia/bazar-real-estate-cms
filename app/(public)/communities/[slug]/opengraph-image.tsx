/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";
import { getAreaGuide } from "@/lib/queries/areas-guide";
import { getSeedAreaGuideBySlug } from "@/lib/seeds/areas";

export const runtime = "edge";
export const alt = "Bazar community guide";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Sprint 11 — composed OG image for /communities/[slug]. Pulls the
 * canonical name + median price strip from the seed (the DB layer's
 * stats jsonb is editorial and Sprint 12 wires DLD ingestion). Falls
 * back to "Abu Dhabi" when nothing matches the slug.
 */
export default async function CommunityOpenGraph({
  params,
}: {
  params: { slug: string };
}) {
  const guide = await getAreaGuide(params.slug);
  const seed = getSeedAreaGuideBySlug(params.slug);
  const name = guide?.name ?? seed?.name ?? "Abu Dhabi";
  const intro = seed?.intro ?? guide?.intro_md ?? "";
  const medianApt = seed?.stats.median_apt_aed_per_ft2;
  const yoy = seed?.stats.yoy_change_pct;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "#f6f3ec",
          padding: "72px 88px",
          fontFamily: "system-ui, sans-serif",
          color: "#1B1A17",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 18,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#7d8e7e",
            }}
          >
            Community guide · Abu Dhabi
          </div>
          <div
            style={{
              marginTop: 24,
              fontFamily: "Georgia, serif",
              fontSize: 96,
              lineHeight: 1.02,
              letterSpacing: "-0.02em",
              maxWidth: 900,
            }}
          >
            {name}.
          </div>
          {intro ? (
            <div
              style={{
                marginTop: 28,
                fontSize: 26,
                lineHeight: 1.4,
                color: "#32312d",
                maxWidth: 920,
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {intro}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            borderTop: "1px solid #d8d4ca",
            paddingTop: 24,
          }}
        >
          <div
            style={{
              fontFamily: "Georgia, serif",
              fontStyle: "italic",
              fontSize: 28,
              color: "#1B1A17",
              letterSpacing: "-0.01em",
            }}
          >
            Bazar{" "}
            <span
              style={{
                fontFamily: "system-ui, sans-serif",
                fontStyle: "normal",
                fontSize: 18,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "#7d8e7e",
              }}
            >
              · bazar.ae
            </span>
          </div>
          {medianApt ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-end",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                fontSize: 20,
                color: "#5a5a55",
              }}
            >
              <div>
                Median apt {medianApt.toLocaleString()} AED/ft²
              </div>
              {yoy !== undefined ? (
                <div style={{ marginTop: 4, color: yoy >= 0 ? "#4B5A4C" : "#B33A2A" }}>
                  YoY {yoy >= 0 ? "+" : ""}
                  {yoy}%
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    ),
    size,
  );
}
