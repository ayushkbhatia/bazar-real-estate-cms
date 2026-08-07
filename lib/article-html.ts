import sanitizeHtml from "sanitize-html";
import { env } from "@/lib/env";
import { MEDIA_BUCKET, mediaPublicUrl } from "@/lib/media";

/**
 * Article bodies are authored as HTML in the Tiptap editor and rendered on the
 * public article page with `dangerouslySetInnerHTML`. Nothing between those two
 * points is trustworthy on its own: the body arrives at the server action as a
 * plain string, so the editor's extension whitelist is a client-side
 * convention, not a constraint. Seeds and migrations write the column directly
 * too.
 *
 * So the allowlist below is the real boundary, and it is applied on both sides
 * of the column — on save, so what's stored is what the editor could have
 * produced, and on render, so rows written before this existed (or by any
 * future path that skips the action) are still safe to inject.
 *
 * The tag list has to stay a superset of what the editor's extensions emit.
 * Anything the editor can produce but this strips would be silently destroyed
 * on the author's next save. Current sources:
 *   - StarterKit: p, h2/h3 (levels are configured), ul, ol, li, blockquote,
 *     pre, code, strong, em, s, hr, br
 *   - Link: a
 *   - FigureImage (lib/tiptap/figure-image.ts): figure, img, figcaption
 *   - Legacy seeded bodies (migration 0050, scripts/seed-demo-content):
 *     h4 and the table family
 */
const ALLOWED_TAGS = [
  "p",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
  "code",
  "strong",
  "b",
  "em",
  "i",
  "s",
  "del",
  "u",
  "hr",
  "br",
  "a",
  "figure",
  "img",
  "figcaption",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
];

/**
 * `data-figure-image` is the marker the editor's node uses to re-parse its own
 * output on load. Strip it and every image in an existing article would come
 * back as a bare, uneditable block the next time someone opened the editor.
 */
const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions["allowedAttributes"] = {
  a: ["href", "target", "rel"],
  img: [
    "src",
    "data-media-key",
    "alt",
    "width",
    "height",
    "loading",
    "decoding",
  ],
  figure: ["data-figure-image"],
  td: ["colspan", "rowspan"],
  th: ["colspan", "rowspan"],
};

/**
 * A media-library storage key: `<folder>/<uuid>-<safe-filename>`, as built by
 * `storageKey()` in lib/media.ts.
 *
 * The pattern is what makes it safe to interpolate into a URL. It admits no
 * `..`, no scheme, no host and no query, so a key taken from stored HTML
 * cannot be steered at another origin or back up out of the bucket.
 */
const MEDIA_KEY_RE =
  /^(listings|brand|blog|team|documents)\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,200}$/;

/**
 * Image sources are restricted to the project's own Supabase Storage bucket.
 * A hotlinked third-party image would leak every reader's IP and referrer to
 * that host, and would rot independently of the media library — the usage
 * index in lib/queries/media-usage.ts can only protect assets it can see.
 *
 * Relative URLs stay allowed so local fixtures and tests keep working.
 */
function allowedImageSrc(src: string): boolean {
  if (src.startsWith("/")) return true;
  const base = env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return false;
  return src.startsWith(
    `${base.replace(/\/+$/, "")}/storage/v1/object/public/${MEDIA_BUCKET}/`,
  );
}

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: ALLOWED_ATTRIBUTES,
  // http/https/mailto/tel only — this is what keeps `javascript:` and
  // `data:` out of href and src.
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowedSchemesAppliedToAttributes: ["href", "src"],
  // Drop the *contents* of a stripped <script>/<style>, not just its tags.
  // Without this, `<script>alert(1)</script>` sanitises to a bare `alert(1)`
  // text node sitting in the article body.
  nonTextTags: ["script", "style", "textarea", "option", "noscript"],
  transformTags: {
    // An editor-authored link can point anywhere. `noopener` closes the
    // reverse-tabnabbing hole that `target="_blank"` opens.
    a: (tagName, attribs) => {
      const out: Record<string, string> = { ...attribs };
      if (out.target === "_blank") out.rel = "noopener noreferrer";
      return { tagName, attribs: out };
    },
    img: (tagName, attribs) => {
      const out: Record<string, string> = { ...attribs };
      // Re-point the image at the *current* project's storage. The stored
      // `src` was resolved when the author inserted it and embeds the project
      // ref of that moment; the key outlives it. Without this, every in-body
      // image 404s the day the Supabase URL changes — which it does at client
      // handover.
      const key = out["data-media-key"];
      if (key && MEDIA_KEY_RE.test(key)) {
        const fresh = mediaPublicUrl(key);
        if (fresh) out.src = fresh;
      } else if (key) {
        // Unparseable key: drop it rather than carry a value nothing trusts.
        delete out["data-media-key"];
      }
      // Sizing hints are cosmetic, so a junk value is dropped rather than
      // treated as a reason to reject the image.
      for (const dim of ["width", "height"] as const) {
        if (out[dim] !== undefined && !/^\d{1,5}$/.test(out[dim])) {
          delete out[dim];
        }
      }
      out.loading = "lazy";
      out.decoding = "async";
      return { tagName, attribs: out };
    },
  },
  exclusiveFilter: (frame) =>
    frame.tag === "img" && !allowedImageSrc(frame.attribs.src ?? ""),
};

/**
 * Allowlist-sanitise an article body. Safe to run repeatedly — sanitising
 * already-sanitised HTML is a no-op, which is what lets it sit on both the
 * save and the render path without the two fighting.
 */
export function sanitizeArticleHtml(html: string): string {
  if (!html) return "";
  return sanitizeHtml(html, OPTIONS);
}
