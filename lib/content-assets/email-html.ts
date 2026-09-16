import sanitizeHtml from "sanitize-html";
import { MEDIA_BUCKET, mediaPublicUrl } from "@/lib/media";
import { env } from "@/lib/env";
import {
  escapeEmailHtml as escape,
  emailSiteUrl,
  type EmailBlock,
} from "@/lib/email-templates";
import type { EmailBrand } from "./email-brand";
import {
  isTokenName,
  tokenDef,
  tokenPattern,
  tokenValue,
  type EmailLocale,
  type TokenContext,
  type TokenName,
} from "./tokens";

/**
 * Rich-text system email bodies: store, render, and flatten to plain text.
 *
 * A rewritten system email is authored in the rich-text editor at
 * /admin/content-assets/emails/<key> and saved as HTML with `{{tokens}}` left
 * in it. Three things then happen to that HTML, all here:
 *
 *  1. SAVE — `sanitizeEmailBody`. The body reaches the server action as a
 *     string, so the editor's extension list is a convention, not a boundary.
 *     This allowlist is the boundary, and it is the same list the editor can
 *     produce, so nothing an editor wrote is lost on the next save.
 *
 *  2. SEND, HTML part — `renderEmailBodyHtml`. Re-sanitised (rows written by a
 *     migration never went through step 1), then given INLINE styles, because
 *     Gmail and most of Outlook discard a <style> block: an <h2> with no style
 *     attribute renders in whatever the inbox thinks a heading is.
 *     Tokens are substituted after sanitising and every value is escaped, so a
 *     lead who types `<script>` into their name sends themselves the literal
 *     word.
 *
 *  3. SEND, text part — `renderEmailBodyText`. The same message as readable
 *     plain text: links keep their address, buttons become "Label: address",
 *     list items get a bullet. A multipart email whose text half is empty is
 *     both worse for accessibility and a spam signal.
 */

/**
 * What the editor produces. Keep in step with the extension list in
 * app/[locale]/(admin)/admin/content-assets/emails/[key]/_body-editor.tsx:
 *   StarterKit (code and code block off): p, h2, h3, strong, em, u, s, ul, ol,
 *     li, blockquote, hr, br, a (Link)
 *   EmailButton (lib/tiptap/email-button.ts): a[data-email-button]
 *   EmailImage (lib/tiptap/email-image.ts): img[data-media-key]
 */
const TAGS = [
  "p",
  "h2",
  "h3",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "a",
  "ul",
  "ol",
  "li",
  "blockquote",
  "hr",
  "br",
  "img",
];

const MEDIA_KEY_RE =
  /^(listings|brand|blog|team)\/[a-zA-Z0-9][a-zA-Z0-9._-]{0,200}$/;

/** A href that is exactly one token: `{{confirm_url}}`. */
const TOKEN_HREF_RE = /^\{\{\s*[a-z_]+\s*\}\}$/i;

function bucketPrefix(): string | null {
  const base = env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base.replace(/\/+$/, "")}/storage/v1/object/public/${MEDIA_BUCKET}/`;
}

/**
 * Images come from the project's own media library and nowhere else. An email
 * image is fetched by the recipient's mail client, so a hotlinked third-party
 * image would hand that host every recipient's IP and open-time — a tracking
 * pixel nobody chose to add.
 */
function allowedImage(attribs: Record<string, string>): boolean {
  const key = attribs["data-media-key"];
  if (key && MEDIA_KEY_RE.test(key)) return true;
  const prefix = bucketPrefix();
  return !!prefix && (attribs.src ?? "").startsWith(prefix);
}

/**
 * Browsers percent-encode braces in a pasted address. A button whose target
 * was `{{confirm_url}}` must not silently become a link to the literal text
 * `%7B%7Bconfirm_url%7D%7D`.
 */
function unescapeTokenHref(href: string): string {
  return href.replace(/%7B%7B\s*([a-z_]+)\s*%7D%7D/gi, "{{$1}}");
}

function baseOptions(): sanitizeHtml.IOptions {
  return {
    allowedTags: TAGS,
    allowedAttributes: {
      a: ["href", "data-email-button"],
      img: ["src", "alt", "width", "data-media-key"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowedSchemesAppliedToAttributes: ["href", "src"],
    allowProtocolRelative: false,
    nonTextTags: ["script", "style", "textarea", "option", "noscript", "title"],
    exclusiveFilter: (frame) => frame.tag === "img" && !allowedImage(frame.attribs),
    transformTags: {
      a: (tagName, attribs) => {
        const out: Record<string, string> = {};
        if (attribs.href) out.href = unescapeTokenHref(attribs.href);
        if ("data-email-button" in attribs) out["data-email-button"] = "";
        return { tagName, attribs: out };
      },
      img: (tagName, attribs) => {
        const out: Record<string, string> = { ...attribs };
        const key = out["data-media-key"];
        if (key && MEDIA_KEY_RE.test(key)) {
          const fresh = mediaPublicUrl(key);
          if (fresh) out.src = fresh;
        } else if (key) {
          delete out["data-media-key"];
        }
        if (out.width !== undefined && !/^\d{1,4}$/.test(out.width)) {
          delete out.width;
        }
        return { tagName, attribs: out };
      },
    },
  };
}

/** Allowlist-sanitise a body for storage. Idempotent. */
export function sanitizeEmailBody(html: string): string {
  if (!html) return "";
  return sanitizeHtml(html, baseOptions()).trim();
}

/**
 * A plain-text body (every system row written before rich text, and the four
 * seeded by migration 0117) as the HTML the editor opens. A blank line starts
 * a paragraph; a single newline stays a line break.
 */
export function textBodyToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escape(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** `body_format` → the HTML to render, whichever way the row was stored. */
export function bodyAsHtml(body: string, format: "text" | "html"): string {
  return format === "html" ? body : textBodyToHtml(body);
}

export type EmailBlocks = Partial<Record<TokenName, EmailBlock>>;

/** Everything a send path knows about one outbound email. */
export type EmailContext = {
  values: TokenContext;
  /** Pre-built panels for the block tokens this email offers. */
  blocks?: EmailBlocks;
};

function styledOptions(
  brand: EmailBrand,
  locale: EmailLocale = "en",
): sanitizeHtml.IOptions {
  // Inline styles are physical, not logical: `padding-inline-start` and
  // `border-inline-start` are ignored by Outlook and by Gmail's Android app,
  // so the side has to be chosen here rather than left to the renderer.
  const start = locale === "ar" ? "right" : "left";
  const base = baseOptions();
  const style =
    (css: string) =>
    (tagName: string, attribs: Record<string, string>) => ({
      tagName,
      attribs: { ...attribs, style: css },
    });
  const baseA = base.transformTags!.a as sanitizeHtml.Transformer;
  const baseImg = base.transformTags!.img as sanitizeHtml.Transformer;
  return {
    ...base,
    allowedAttributes: {
      a: ["href", "data-email-button", "style"],
      img: ["src", "alt", "width", "data-media-key", "style"],
      p: ["style"],
      h2: ["style"],
      h3: ["style"],
      ul: ["style"],
      ol: ["style"],
      li: ["style"],
      blockquote: ["style"],
      hr: ["style"],
    },
    transformTags: {
      p: style("margin:0 0 14px"),
      h2: style(
        locale === "ar"
          ? // Georgia has no Arabic, and a serif heading over a sans body is a
            // Latin device; Arabic takes weight instead.
            `margin:26px 0 10px;font-weight:600;font-size:23px;line-height:1.45;color:${brand.textColor}`
          : `margin:26px 0 10px;font-family:Georgia,serif;font-weight:normal;font-size:24px;line-height:1.2;letter-spacing:-0.015em;color:${brand.textColor}`,
      ),
      h3: style(
        `margin:22px 0 8px;font-size:16px;font-weight:600;line-height:1.3;color:${brand.textColor}`,
      ),
      ul: style(`margin:0 0 14px;padding-${start}:22px`),
      ol: style(`margin:0 0 14px;padding-${start}:22px`),
      li: style("margin:0 0 4px"),
      blockquote: style(
        `margin:20px 0;padding:12px 16px;background:#fff;border-${start}:3px solid ${brand.linkColor};font-style:${locale === "ar" ? "normal" : "italic"};color:#32312d`,
      ),
      hr: style("border:0;border-top:1px solid #E5E5DF;margin:24px 0"),
      a: (tagName, attribs) => {
        const t = baseA(tagName, attribs);
        const isButton = "data-email-button" in t.attribs;
        return {
          tagName,
          attribs: {
            ...t.attribs,
            style: isButton
              ? `display:inline-block;padding:11px 18px;background:${brand.buttonColor};color:${brand.buttonTextColor};text-decoration:none;border-radius:6px;font-size:14px;font-weight:500`
              : `color:${brand.linkColor};text-decoration:underline`,
          },
        };
      },
      img: (tagName, attribs) => {
        const t = baseImg(tagName, attribs);
        const width = t.attribs.width ? `width:${t.attribs.width}px;` : "";
        return {
          tagName,
          attribs: {
            ...t.attribs,
            style: `display:block;${width}max-width:100%;height:auto;border:0;margin:0 0 14px`,
          },
        };
      },
    },
  };
}

/** Escape a token value for an HTML text position; newlines become breaks. */
function htmlValue(value: string): string {
  return escape(value).replace(/\r?\n/g, "<br>");
}

function blockFor(name: TokenName, ctx: EmailContext): EmailBlock | null {
  if (tokenDef(name).kind !== "block") return null;
  return ctx.blocks?.[name] ?? { html: "", text: "" };
}

/**
 * A link target after substitution. Relative paths are made absolute — a
 * relative link in an inbox has no site to be relative to. Anything that is
 * not http(s), mailto or tel is dropped, which is what stops a token value
 * like `javascript:` from becoming a clickable link.
 */
function safeHref(raw: string): string | null {
  const href = raw
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .trim();
  if (href.startsWith("/") && !href.startsWith("//"))
    return `${emailSiteUrl()}${href}`;
  if (/^(https?:|mailto:|tel:)/i.test(href)) return href;
  return null;
}

/**
 * A stored body → the HTML half of a sendable email, styled for inboxes.
 * Does not add the shell; `renderSystemEmail` does that.
 */
export function renderEmailBodyHtml(
  body: string,
  ctx: EmailContext,
  brand: EmailBrand,
  locale: EmailLocale = "en",
): string {
  let html = sanitizeHtml(body, styledOptions(brand, locale));

  // A block token on a line of its own replaces the whole paragraph — a panel
  // is a <div> or <table>, and neither may sit inside a <p>. The panel goes in
  // as a placeholder and is swapped back last, so nothing below — the token
  // pass included — ever reads the lead's data inside it.
  const panels: string[] = [];
  html = html.replace(
    /<p style="[^"]*">\s*\{\{\s*([a-z_]+)\s*\}\}\s*<\/p>/gi,
    (match, raw: string) => {
      const name = raw.toLowerCase();
      if (!isTokenName(name)) return match;
      const block = blockFor(name, ctx);
      if (!block) return match;
      panels.push(block.html);
      return ` ${panels.length - 1} `;
    },
  );

  // Every other token, in ONE pass over tags and text. One pass matters: a
  // value is never re-read for tokens, so a lead who types "{{confirm_url}}"
  // into their name gets those characters back, not somebody's link.
  const value = (raw: string) => {
    const name = raw.toLowerCase();
    if (!isTokenName(name)) return "";
    const block = blockFor(name, ctx);
    return (block ? block.text : tokenValue(name, ctx.values)).replace(/ /g, "");
  };
  html = html
    .split(/(<[^>]+>)/)
    .map((segment) =>
      segment.startsWith("<")
        ? // Inside a tag: attribute values — escaped, no line breaks.
          segment.replace(tokenPattern(), (_t, raw: string) => escape(value(raw)))
        : // Text: escaped, line breaks kept. A block token inside a sentence
          // gets its plain-text form rather than a broken panel.
          segment.replace(tokenPattern(), (_t, raw: string) => htmlValue(value(raw))),
    )
    .join("");

  // Link targets, now that tokens are filled.
  html = html.replace(/<a ([^>]*)>/g, (_m, attrs: string) => {
    const next = attrs.replace(/href="([^"]*)"/, (_h, value: string) => {
      const safe = safeHref(value);
      return safe ? `href="${escape(safe)}"` : "";
    });
    return `<a ${next.trim()}>`;
  });

  // A paragraph or heading that rendered to nothing — an optional token with
  // no value, like the property line on a general enquiry — is dropped rather
  // than left as a blank gap in the email.
  html = html.replace(
    /<(p|h2|h3|li) style="[^"]*">(?:\s|&nbsp;|<br\s*\/?>)*<\/\1>/g,
    "",
  );
  // …and a quote or list with nothing left inside it goes with them.
  html = html.replace(/<(blockquote|ul|ol) style="[^"]*">\s*<\/\1>/g, "");

  // Nested paragraphs keep the rhythm of their container, not their own margin.
  html = html.replace(/<(li|blockquote) style="[^"]*">[\s\S]*?<\/\1>/g, (seg) =>
    seg.replace(/<p style="margin:0 0 14px">/g, '<p style="margin:0">'),
  );

  // Buttons stand on their own line with room around them.
  html = html.replace(
    /(<a [^>]*data-email-button[^>]*>[\s\S]*?<\/a>)/g,
    '<p style="margin:22px 0">$1</p>',
  );

  return html.replace(/ (\d+) /g, (_m, i: string) => panels[Number(i)] ?? "");
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  mdash: "—",
  ndash: "–",
  hellip: "…",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, code: string) => {
    if (code.startsWith("#x") || code.startsWith("#X"))
      return String.fromCodePoint(parseInt(code.slice(2), 16));
    if (code.startsWith("#")) return String.fromCodePoint(parseInt(code.slice(1), 10));
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

/**
 * A stored body → the plain-text half. Structure is flattened by hand rather
 * than by a library: the input has already been through the allowlist, so the
 * tag set is small and known.
 */
export function renderEmailBodyText(
  body: string,
  ctx: EmailContext,
  locale: EmailLocale = "en",
): string {
  let html = sanitizeEmailBody(body);

  html = html.replace(/<br\s*\/?>/g, "\n");
  html = html.replace(/<img[^>]*>/g, "");
  html = html.replace(/<hr\s*\/?>/g, "\n\n");

  // Buttons: "Confirm subscription: https://…"
  html = html.replace(
    /<a [^>]*data-email-button[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>|<a href="([^"]*)"[^>]*data-email-button[^>]*>([\s\S]*?)<\/a>/g,
    (_m, h1: string, l1: string, h2: string, l2: string) =>
      `\n\n${stripTags(l1 ?? l2).trim()}: ${h1 ?? h2}\n\n`,
  );
  // Links keep their address unless the label already is it.
  html = html.replace(
    /<a href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g,
    (_m, href: string, label: string) => {
      const text = stripTags(label).trim();
      return text === href || !href ? text : `${text} (${href})`;
    },
  );

  // Ordered lists are numbered, bulleted lists get a middle dot.
  html = html.replace(/<ol>([\s\S]*?)<\/ol>/g, (_m, inner: string) => {
    let n = 0;
    return `\n\n${inner.replace(/<li>([\s\S]*?)<\/li>/g, (_l, item: string) => `${++n}. ${stripTags(item).trim()}\n`)}\n`;
  });
  html = html.replace(/<ul>([\s\S]*?)<\/ul>/g, (_m, inner: string) =>
    `\n\n${inner.replace(/<li>([\s\S]*?)<\/li>/g, (_l, item: string) => `· ${stripTags(item).trim()}\n`)}\n`,
  );

  html = html.replace(/<blockquote>([\s\S]*?)<\/blockquote>/g, (_m, inner: string) => {
    const quoted = stripTags(inner.replace(/<\/p>\s*<p>/g, "\n"))
      .trim()
      .split("\n")
      .map((l) => `> ${l}`)
      .join("\n");
    return `\n\n${quoted}\n\n`;
  });

  html = html.replace(/<\/(p|h2|h3)>/g, "\n\n");
  let text = decodeEntities(stripTags(html));

  text = text.replace(tokenPattern(), (_t, raw: string) => {
    const name = raw.toLowerCase();
    if (!isTokenName(name)) return "";
    const block = blockFor(name, ctx);
    return block ? block.text : tokenValue(name, ctx.values, locale);
  });

  return text
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/g, ""))
    // A quoted optional token with no value leaves a bare quote marker.
    .filter((l) => l !== ">")
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Whether a href is a single token — the editor offers these as targets. */
export function isTokenHref(href: string): boolean {
  return TOKEN_HREF_RE.test(href.trim());
}
