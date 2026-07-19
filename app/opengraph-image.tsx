import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Bazar Real Estate — Abu Dhabi, properly understood";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#1B1A17",
          color: "#FAFAF6",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 96,
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 12,
            fontSize: 28,
            color: "#99896e",
          }}
        >
          <span style={{ fontStyle: "italic" }}>Bazar</span>
          <span style={{ fontSize: 16, letterSpacing: "0.08em" }}>
            · Abu Dhabi
          </span>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
            maxWidth: 980,
          }}
        >
          <div
            style={{
              fontSize: 88,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              fontStyle: "italic",
            }}
          >
            Abu Dhabi, properly understood.
          </div>
          <div
            style={{
              fontSize: 22,
              color: "#a8a8a3",
              lineHeight: 1.5,
              fontFamily: "system-ui, sans-serif",
              fontStyle: "normal",
            }}
          >
            Curated marketplace and bespoke advisory for buyers, sellers,
            and investors across the United Arab Emirates.
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 16,
            color: "#99896e",
            letterSpacing: "0.05em",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <span>BAZAR-REAL-ESTATE.AE</span>
          <span>ORN 28041</span>
        </div>
      </div>
    ),
    size,
  );
}
