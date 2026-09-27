import sanitizeHtml from "sanitize-html";
import { env } from "@/lib/env";
import { MEDIA_BUCKET, mediaPublicUrl } from "@/lib/media";
import {
  ANCHOR_ATTR,
  BLOCK_ATTR,
  readAnchorRef,
  readBlockAttrs,
} from "@/lib/internal-links/model";

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
 *   - InternalLink (lib/tiptap/internal-link.ts): div, as a link block only
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
  "div",
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
  // The internal-link pair is what makes a text link survive a rename; strip
  // it and the link silently reverts to the URL it had when it was written.
  a: ["href", "target", "rel", ANCHOR_ATTR.kind, ANCHOR_ATTR.id],
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
  // A link block is an empty `<div>` whose attributes ARE its content.
  div: [BLOCK_ATTR.kind, BLOCK_ATTR.id, BLOCK_ATTR.variant, BLOCK_ATTR.label],
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
      // The pair is kept whole or not at all — a kind without a readable id
      // (or the reverse) points at nothing, and the renderer would have to
      // guess which half to believe.
      const ref = readAnchorRef(out);
      delete out[ANCHOR_ATTR.kind];
      delete out[ANCHOR_ATTR.id];
      if (ref) {
        out[ANCHOR_ATTR.kind] = ref.kind;
        out[ANCHOR_ATTR.id] = ref.id;
      }
      return { tagName, attribs: out };
    },
    /*
     * The only `<div>` the editor writes is a link block, so the attributes
     * are rebuilt from the validated read rather than passed through: an
     * unknown variant becomes the default, the id is lowercased, the label is
     * trimmed and capped. Anything that is not a readable block loses every
     * attribute and is judged by `exclusiveFilter` below.
     */
    div: (tagName, attribs) => {
      const block = readBlockAttrs(attribs);
      if (!block) return { tagName, attribs: {} };
      const out: Record<string, string> = {
        [BLOCK_ATTR.kind]: block.kind,
        [BLOCK_ATTR.id]: block.id,
        [BLOCK_ATTR.variant]: block.variant,
      };
      if (block.label) out[BLOCK_ATTR.label] = block.label;
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
  exclusiveFilter: (frame) => {
    if (frame.tag === "img") return !allowedImageSrc(frame.attribs.src ?? "");
    // An empty `<div>` that is not a link block — a block whose target could
    // not be read, or markup pasted in by a direct write — would render as an
    // invisible element that still takes a paragraph's worth of margin. A
    // `<div>` with text in it keeps the text.
    if (frame.tag === "div") {
      return !frame.attribs[BLOCK_ATTR.kind] && !frame.text.trim();
    }
    return false;
  },
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
