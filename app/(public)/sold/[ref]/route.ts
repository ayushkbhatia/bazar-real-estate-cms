/**
 * Sprint 11 — 410 Gone for sold listings.
 *
 * Route returns status 410 with a branded HTML body. The page-style
 * /sold/[ref]/page.tsx that lived here in Sprint 4c shipped 200 OK with
 * a noindex meta — that worked for search engines but broke the
 * semantic contract for any UA that reads the status code.
 *
 * Property pages redirect here via Sprint 11 wiring on /p/[slug]: when
 * the property has `sold_at` set (Sprint 8 column) OR status is
 * 'off_market', the detail page server-redirects to /sold/[reference].
 */

import { type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ ref: string }> },
) {
  const { ref } = await ctx.params;
  const safeRef = ref.toUpperCase().replace(/[^A-Z0-9-]/g, "");

  const body = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,follow">
  <title>${safeRef} — sold · Bazar</title>
  <link rel="icon" href="/icon.png">
  <link rel="canonical" href="https://bazar.ae/sold/${encodeURIComponent(ref)}">
  <style>
    :root { color-scheme: light dark; }
    html, body { margin: 0; padding: 0; background: #FAFAF6; color: #1B1A17; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; }
    @media (prefers-color-scheme: dark) {
      html, body { background: #0F0F0E; color: #ECECE8; }
    }
    main { max-width: 640px; margin: 0 auto; padding: 80px 32px 56px; text-align: center; }
    .eyebrow { font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: #7d8e7e; }
    h1 { font-family: Georgia, serif; font-size: 56px; line-height: 1.05; letter-spacing: -0.025em; margin: 12px 0 0; font-weight: 400; }
    p { font-size: 15.5px; line-height: 1.6; color: #32312d; margin-top: 20px; }
    @media (prefers-color-scheme: dark) { p { color: #c5c5c0; } }
    .ref { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #1B1A17; }
    @media (prefers-color-scheme: dark) { .ref { color: #ECECE8; } }
    .actions { margin-top: 32px; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
    a.btn { display: inline-block; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-size: 13.5px; }
    a.primary { background: #1B1A17; color: #fff; }
    @media (prefers-color-scheme: dark) { a.primary { background: #ECECE8; color: #0F0F0E; } }
    a.outline { border: 1px solid #d8d4ca; color: #1B1A17; }
    @media (prefers-color-scheme: dark) { a.outline { border-color: #2a2926; color: #ECECE8; } }
  </style>
</head>
<body>
  <main>
    <div class="eyebrow">410 · Sold</div>
    <h1>This listing has sold.</h1>
    <p>
      The property referenced <span class="ref">${safeRef}</span> is no longer
      on the market. You can browse similar listings, or send us a brief and
      we&rsquo;ll surface comparable off-market stock.
    </p>
    <div class="actions">
      <a class="btn primary" href="/buy">Browse the marketplace</a>
      <a class="btn outline" href="/concierge">Tell us what you&rsquo;re looking for</a>
    </div>
  </main>
</body>
</html>`;

  return new Response(body, {
    status: 410,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      "X-Robots-Tag": "noindex, follow",
    },
  });
}
