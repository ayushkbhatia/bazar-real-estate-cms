/**
 * Turn Tiptap HTML into translatable units and put the translations back.
 *
 * The naive version of this — collect every text node, translate each one,
 * splice them back — is wrong here, and wrong in a way that only shows up in
 * Arabic. `<p>A <strong>luxury</strong> villa</p>` is three text nodes, and
 * "A ", "luxury" and " villa" translated in isolation cannot be reassembled:
 * Arabic reorders across exactly those boundaries, and two of the three
 * fragments are not sentences at all. You get grammatical rubble with the bold
 * tag in the right place.
 *
 * So the unit is the *block* — a paragraph, a heading, a list item — and the
 * inline tags inside it are masked exactly the way prices are, as `⟦mN⟧`.
 * The model receives one whole sentence with opaque markers in it, is free to
 * move them where Arabic word order requires, and never sees a tag.
 *
 * Four of the guards below exist because adversarial review broke this file
 * after its own thirty-three tests passed. Every one of those defects
 * corrupted markup silently, and `markIssues` reported nothing for three of
 * the four. The comments name the input that broke each one.
 */

/** Tags that end a translatable run. Everything here is a Tiptap block node. */
const BLOCK_TAGS = new Set([
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
  "hr",
  "div",
  "table",
  "tr",
  "td",
  "th",
  "figure",
  "figcaption",
]);

type Token =
  | { kind: "tag"; raw: string; name: string; block: boolean }
  | { kind: "text"; raw: string };

/**
 * A tag, skipping over quoted attribute values.
 *
 * The obvious `<\/?([a-zA-Z][\w-]*)\b[^>]*>` is wrong, and expensively so.
 * `[^>]*` stops at the FIRST `>`, including one inside a quoted attribute, so
 * `href="https://bazar.ae/x?q=a>b"` splits one anchor into a truncated "tag"
 * plus the text `b">this`. Three things then go wrong at once: attribute bytes
 * — including a storage media key, in the blog's figure node — are sent to a
 * translation model; the identity round trip stops being a no-op, because the
 * tag-closing `>` comes back as `&gt;`; and once a translation moves the
 * markers, the leftover fragment is dropped and the anchor points at a
 * DIFFERENT URL. Nothing reports any of it.
 *
 * Both the link toolbar and the image-alt field can produce a raw `>`: HTML
 * fragment serialisation escapes only `&`, `"` and U+00A0 inside an attribute
 * value, so it survives into the stored markup.
 */
const TAG_RE = /<\/?([a-zA-Z][\w-]*)(?:"[^"]*"|'[^']*'|[^>"'])*>/g;

function tokenize(html: string): Token[] {
  const tokens: Token[] = [];
  let cursor = 0;
  for (const m of html.matchAll(TAG_RE)) {
    const at = m.index ?? 0;
    if (at > cursor) tokens.push({ kind: "text", raw: html.slice(cursor, at) });
    const name = m[1].toLowerCase();
    tokens.push({ kind: "tag", raw: m[0], name, block: BLOCK_TAGS.has(name) });
    cursor = at + m[0].length;
  }
  if (cursor < html.length) tokens.push({ kind: "text", raw: html.slice(cursor) });
  return tokens;
}

/**
 * Entities. The model should see "&", not "&amp;" — an escaped ampersand in a
 * prompt comes back as anything from "&amp;amp;" to the word "and".
 *
 * The tables are a bijection on purpose, and only over what Tiptap's
 * serialiser emits. Decoding an entity we cannot re-encode silently rewrites
 * the document, and `&nbsp;` proves it: decoded to an ordinary space,
 * "AED&nbsp;12,500,000" becomes text that may break the line between the
 * currency and the figure, which is exactly what the non-breaking space was
 * there to prevent. It decodes to U+00A0 and encodes back.
 *
 * `&quot;` and `&#39;` are absent for the same reason in reverse. ProseMirror
 * serialises through the DOM and `innerHTML` does not escape quotes inside a
 * text node, so they never appear — and decoding them without a matching
 * encode would break the round trip for nothing.
 */
const NBSP = " ";

const DECODE: [RegExp, string][] = [
  [/&lt;/g, "<"],
  [/&gt;/g, ">"],
  [/&nbsp;/g, NBSP],
  [/&amp;/g, "&"], // last, so "&amp;lt;" does not become "<"
];

const ENCODE: [RegExp, string][] = [
  [/&/g, "&amp;"], // first, for the same reason in reverse
  [/</g, "&lt;"],
  [/>/g, "&gt;"],
  [/ /g, "&nbsp;"],
];

export function decodeEntities(s: string): string {
  return DECODE.reduce((acc, [re, to]) => acc.replace(re, to), s);
}

export function encodeEntities(s: string): string {
  return ENCODE.reduce((acc, [re, to]) => acc.replace(re, to), s);
}

/**
 * Normalise entities a model put into its own output.
 *
 * Models re-escape. Ask one to translate `Ben & Co.` and a fair share of the
 * time it returns `Ben &amp; Co.`, which is then encoded again and renders on
 * the page as the literal text "&amp;". This runs on model output only, and
 * deliberately NOT inside `fromSlots`, so that function stays an exact inverse
 * of `toSlots` and the identity round trip keeps its meaning.
 */
export function normaliseModelEntities(s: string): string {
  return decodeEntities(s);
}

export type HtmlSlot = {
  /** Block text with inline tags as ⟦mN⟧ and entities decoded. */
  text: string;
  /** `marks[n]` is the raw tag for ⟦mn⟧. */
  marks: string[];
  /** Token span this slot occupies, for splicing back. */
  from: number;
  to: number;
};

export type HtmlDocument = {
  tokens: Token[];
  slots: HtmlSlot[];
  /**
   * Blocks left untranslated because the author's own text contains the marker
   * syntax. Surfaced so a caller can say so rather than appear to have
   * translated the whole document.
   */
  skipped: number;
};

const MARKER_RE = /⟦m(\d+)⟧/g;

/**
 * Marker syntax in the author's own text, in either namespace.
 *
 * A paragraph that literally contains "⟦m0⟧" — or "⟦0⟧", which `mask()` uses
 * for prices — cannot survive the round trip: on the way back it is read as a
 * marker and either deleted or turned into a duplicate opening tag, and
 * nothing reports it. Such a block keeps its English instead, which is the
 * same fallback a rejected translation gets.
 */
const AUTHOR_MARKER_RE = /⟦\s*m?\d+\s*⟧/;

/** Does this run contain anything a person would read? */
function hasWords(text: string): boolean {
  return text.replace(MARKER_RE, "").trim().length > 0;
}

export function toSlots(html: string): HtmlDocument {
  const tokens = tokenize(html);
  const slots: HtmlSlot[] = [];
  let skipped = 0;

  let text = "";
  let marks: string[] = [];
  let authored = "";
  let from = -1;

  const flush = (to: number) => {
    if (from !== -1 && hasWords(text)) {
      if (AUTHOR_MARKER_RE.test(authored)) skipped++;
      else slots.push({ text, marks, from, to });
    }
    text = "";
    marks = [];
    authored = "";
    from = -1;
  };

  tokens.forEach((token, i) => {
    if (token.kind === "tag" && token.block) {
      flush(i);
      return;
    }
    if (from === -1) from = i;
    if (token.kind === "text") {
      const decoded = decodeEntities(token.raw);
      text += decoded;
      authored += decoded;
    } else {
      text += `⟦m${marks.length}⟧`;
      marks.push(token.raw);
    }
  });
  flush(tokens.length);

  return { tokens, slots, skipped };
}

/** Mark markers present in a string, in order. */
export function marksIn(text: string): number[] {
  return [...text.matchAll(MARKER_RE)].map((m) => Number(m[1]));
}

/** Does this raw tag open a scope that needs a matching close? */
function opensScope(raw: string): boolean {
  return (
    !/^<\//.test(raw) && !/\/>$/.test(raw) && !/^<(br|hr|img|input)\b/i.test(raw)
  );
}

/**
 * Are this slot's marks intact in the translation?
 *
 * Identity is checked, not position — Arabic moves them, and that is the point
 * of markers. Nesting IS checked, because markup that does not nest is not
 * markup. The first version compared each pair only against itself, which
 * happily accepted `⟦m0⟧a ⟦m1⟧b⟦m3⟧ c⟦m2⟧` and spliced it into
 * `<strong>a <em>b</strong> c</em>`.
 */
export function markIssues(slot: HtmlSlot, translated: string): string[] {
  const issues: string[] = [];
  const want = new Set(marksIn(slot.text));
  const got = marksIn(translated);
  const gotSet = new Set(got);

  for (const n of want) {
    if (!gotSet.has(n)) issues.push(`formatting marker ⟦m${n}⟧ dropped`);
  }
  for (const n of gotSet) {
    if (!want.has(n)) issues.push(`formatting marker ⟦m${n}⟧ invented`);
  }
  if (got.length !== gotSet.size) {
    issues.push("a formatting marker was duplicated");
  }
  if (issues.length > 0) return issues;

  // Pair opens with closes in the source's own order, then replay the
  // translation's order through a stack. Anything that does not pop cleanly is
  // markup that cannot nest.
  const partner = new Map<number, number>();
  const opening = new Set<number>();
  const stack: number[] = [];
  for (const n of marksIn(slot.text)) {
    const raw = slot.marks[n];
    if (opensScope(raw)) {
      stack.push(n);
      opening.add(n);
    } else if (/^<\//.test(raw)) {
      const open = stack.pop();
      if (open !== undefined) {
        partner.set(open, n);
        partner.set(n, open);
      }
    }
  }

  const live: number[] = [];
  for (const n of got) {
    if (!partner.has(n)) continue; // unpaired, e.g. <br> — nothing to cross
    if (opening.has(n)) {
      live.push(n);
      continue;
    }
    if (live.pop() !== partner.get(n)) {
      issues.push(
        `formatting markers are interleaved — ⟦m${n}⟧ closes out of order`,
      );
      return issues;
    }
  }
  if (live.length > 0) {
    issues.push(`formatting marker ⟦m${live[0]}⟧ is never closed`);
  }

  return issues;
}

/**
 * Rebuild the document, replacing each slot's text with its translation.
 *
 * `translations[i]` may be null, meaning that block was rejected — it keeps
 * its English. A partly translated description is a real and acceptable
 * outcome; a mangled one is not.
 */
export function fromSlots(
  doc: HtmlDocument,
  translations: (string | null)[],
): string {
  const replacement = new Map<number, string>();

  doc.slots.forEach((slot, i) => {
    const translated = translations[i];
    if (translated == null) return;
    replacement.set(slot.from, rebuildSlot(translated, slot.marks));
  });

  let out = "";
  let skipTo = -1;
  doc.tokens.forEach((token, i) => {
    if (i < skipTo) return;
    const swap = replacement.get(i);
    if (swap !== undefined) {
      out += swap;
      skipTo = doc.slots.find((s) => s.from === i)!.to;
      return;
    }
    out += token.raw;
  });
  return out;
}

/**
 * Split a translation at its markers: the gaps are text and get encoded, the
 * markers become their raw tags and do not.
 *
 * The previous version searched the rebuilt string for each mark's raw text so
 * it could skip encoding there, and that approach is unfixable rather than
 * merely buggy. A block containing the *escaped* text `&lt;strong&gt;` decodes
 * to the literal characters `<strong>`; the search then matched the author's
 * visible text as though it were one of the tags, refused to re-encode it, and
 * published it as live markup — an extra unclosed `<strong>` in the document.
 * Splitting positionally cannot make that mistake, because a marker's identity
 * comes from where it is, not from what it looks like.
 */
function rebuildSlot(translated: string, marks: string[]): string {
  let out = "";
  let cursor = 0;
  for (const m of translated.matchAll(MARKER_RE)) {
    const at = m.index ?? 0;
    out += encodeEntities(translated.slice(cursor, at));
    // An out-of-range marker contributes nothing: markIssues has already
    // rejected the slot if it mattered, and a literal "⟦m9⟧" rendering on a
    // public page is worse than a missing <em>.
    out += marks[Number(m[1])] ?? "";
    cursor = at + m[0].length;
  }
  return out + encodeEntities(translated.slice(cursor));
}
