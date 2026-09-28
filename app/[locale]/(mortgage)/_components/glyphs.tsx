import type { ReactNode } from "react";
import type { DocKind } from "@/lib/mortgage-requests/documents";

/**
 * The flow's glyphs, drawn from the design's own paths (`MRQ_P` in
 * docs/mortgage/frontend/00-foundations/reference/mreq-shared.jsx): the five
 * document shapes have no lucide equivalent that reads the same at 20px, and
 * the rest are kept with them so every icon in the flow has one stroke.
 * Generic controls (arrows, ✕, upload) use lucide-react like the rest of the
 * site.
 */
const PATHS = {
  idCard: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="11" r="2.2" />
      <path d="M5.3 16.3c.7-1.3 1.8-2 3.2-2s2.5.7 3.2 2M14 10h4.5M14 13.5h3" />
    </>
  ),
  passport: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <circle cx="12" cy="10" r="3.2" />
      <path d="M8.8 10h6.4M9 17h6" />
    </>
  ),
  cert: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M14 3v5h5M9 12h7M9 15.5h7M9 19h3.5" />
    </>
  ),
  licence: (
    <>
      <path d="M5 3h14v18H5z" />
      <path d="M8 7h8M8 10.5h8M8 14h3.5" />
      <circle cx="15.5" cy="16.5" r="2.2" />
    </>
  ),
  statement: (
    <>
      <path d="M8 3h11v14" />
      <rect x="4" y="6.5" width="12" height="14.5" rx="1" />
      <path d="M7 11h6M7 14h6M7 17h3.5" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10.5" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3M12 14.5V17" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  chat: <path d="M20 12a8 8 0 0 1-11.7 7.1L4 20l1-4.1A8 8 0 1 1 20 12Z" />,
  alert: (
    <>
      <path d="M12 3.5 2.5 20h19L12 3.5Z" />
      <path d="M12 10v4.5" />
      <circle cx="12" cy="17.3" r=".7" fill="currentColor" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 5 6v5c0 4.5 3 8.2 7 10 4-1.8 7-5.5 7-10V6l-7-3Z" />
      <path d="m9 12 2.2 2.2L15.5 10" />
    </>
  ),
  switch: <path d="M4 8h13l-3-3M20 16H7l3 3" />,
  doc: (
    <>
      <path d="M6 3h9l4 4v14H6z" />
      <path d="M14 3v5h5M9 13h7M9 17h5" />
    </>
  ),
  chart: (
    <>
      <path d="M4 20V4M4 20h16" />
      <path d="M8 16v-4M12 16V8M16 16v-2" />
    </>
  ),
  phone: (
    <path d="M5 4h4l2 5-3 2a12 12 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 6a2 2 0 0 1 2-2Z" />
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  tick: <path d="m5 12 5 5L20 7" />,
} satisfies Record<string, ReactNode>;

export type GlyphName = keyof typeof PATHS;

export function Glyph({
  name,
  size = 16,
  strokeWidth = 1.6,
  className,
}: {
  name: GlyphName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}

/** The document's shape on its tile (W5–W7). */
export const DOC_GLYPH: Record<DocKind, GlyphName> = {
  emirates_id: "idCard",
  passport: "passport",
  salary_certificate: "cert",
  bank_statements_3m: "statement",
  trade_license: "licence",
  bank_statements_12m: "statement",
};
