import { describe, expect, it } from "vitest";
import {
  fromSlots,
  markIssues,
  marksIn,
  normaliseModelEntities,
  toSlots,
} from "./html";

/**
 * The guarantee this file exists to hold: markup cannot be corrupted, because
 * the model never receives any.
 *
 * The strongest form of that is an identity — feed each slot's own text back
 * as its "translation" and the document must come out byte-identical. If that
 * holds for a shape, no translation of that shape can damage its structure,
 * because structure is carried entirely outside the translated text.
 */
const SAMPLES: [string, string][] = [
  ["plain paragraph", "<p>A five bedroom villa.</p>"],
  [
    "inline marks",
    "<p>A <strong>luxury</strong> villa with a <em>private</em> pool.</p>",
  ],
  [
    "nested marks",
    "<p>A <strong>very <em>luxurious</em></strong> villa.</p>",
  ],
  [
    "multiple blocks",
    "<h2>Overview</h2><p>First.</p><p>Second.</p>",
  ],
  [
    "lists",
    "<ul><li>Sea view</li><li>Maid's room</li></ul>",
  ],
  [
    "link with attributes",
    '<p>See the <a href="https://bazar.ae/p/x?a=1&amp;b=2" rel="noopener">listing</a> today.</p>',
  ],
  ["blockquote", "<blockquote><p>Quiet street.</p></blockquote>"],
  ["hard break", "<p>Line one<br>Line two</p>"],
  ["entities", '<p>Ben &amp; Co. said "yes" &lt;today&gt;.</p>'],
  ["nbsp", "<p>AED&nbsp;12,500,000 today.</p>"],
  ["empty paragraph", "<p></p>"],
  ["whitespace only", "<p>   </p>"],
  ["horizontal rule", "<p>Before.</p><hr><p>After.</p>"],
  ["heading levels", "<h2>A</h2><h3>B</h3>"],
  ["adjacent marks", "<p><strong>A</strong><em>B</em></p>"],
  ["mark spanning whole block", "<p><strong>All bold.</strong></p>"],
  ["empty document", ""],
  // Every entry below broke a previous version of this file. They were found
  // by adversarial review, after the thirty-odd cases above already passed.
  [
    "raw > inside an href",
    '<p>See <a target="_blank" href="https://bazar.ae/x?q=a>b">this</a>.</p>',
  ],
  [
    "raw > inside an image alt",
    '<figure><img src="/x.png" alt="Kitchen > dining"><figcaption>The <strong>new</strong> kitchen.</figcaption></figure>',
  ],
  [
    "escaped tag text beside a real tag of the same name",
    "<p>Use &lt;strong&gt; for a <strong>bold</strong> claim.</p>",
  ],
  ["escaped br beside a real br", "<p>Type &lt;br&gt; here<br>next line</p>"],
  [
    "escaped tag inside the tag it names",
    "<p>The <em>&lt;em&gt;</em> tag.</p>",
  ],
  ["single quoted attribute", "<p>A <a href='/x?a>b'>link</a>.</p>"],
];

describe("round-trips byte-identically when nothing is translated", () => {
  it.each(SAMPLES)("%s", (_name, html) => {
    const doc = toSlots(html);
    const same = fromSlots(
      doc,
      doc.slots.map((s) => s.text),
    );
    expect(same).toBe(html);
  });
});

describe("what reaches the model", () => {
  it("sends a whole sentence with tags as opaque markers", () => {
    // The reason blocks are the unit: "A ", "luxury", " villa" translated
    // separately cannot be reassembled into Arabic.
    const doc = toSlots("<p>A <strong>luxury</strong> villa.</p>");
    expect(doc.slots).toHaveLength(1);
    expect(doc.slots[0].text).toBe("A ⟦m0⟧luxury⟦m1⟧ villa.");
    expect(doc.slots[0].marks).toEqual(["<strong>", "</strong>"]);
  });

  it("never exposes an attribute value", () => {
    // An href must not be translatable — it is inside the tag, so it travels
    // inside the marker and the model cannot see it.
    const doc = toSlots('<p>See the <a href="https://bazar.ae/x">listing</a>.</p>');
    expect(doc.slots[0].text).not.toContain("bazar.ae");
    expect(doc.slots[0].marks[0]).toContain("bazar.ae");
  });

  it("decodes entities so the model sees real characters", () => {
    const doc = toSlots('<p>Ben &amp; Co. said "yes".</p>');
    expect(doc.slots[0].text).toBe('Ben & Co. said "yes".');
  });

  it("preserves a non-breaking space rather than flattening it", () => {
    // AED&nbsp;12,500,000 exists to stop a line break between the currency
    // and the figure. Decoding it to an ordinary space silently loses that,
    // and the identity round trip above is what caught it.
    const doc = toSlots("<p>AED&nbsp;12,500,000</p>");
    expect(doc.slots[0].text).toBe("AED\u00A012,500,000");
    expect(fromSlots(doc, ["\u00A012,500,000 AED"])).toBe(
      "<p>&nbsp;12,500,000 AED</p>",
    );
  });

  it("skips blocks with no words", () => {
    // Empty and whitespace-only paragraphs are structure, not content, and
    // sending them wastes a call and trips the validator's empty check.
    expect(toSlots("<p></p><p>   </p><p><br></p>").slots).toHaveLength(0);
  });

  it("treats each list item as its own unit", () => {
    const doc = toSlots("<ul><li>Sea view</li><li>Maid's room</li></ul>");
    expect(doc.slots.map((s) => s.text)).toEqual(["Sea view", "Maid's room"]);
  });
});

describe("splicing a translation back", () => {
  it("puts markers back where Arabic word order moved them", () => {
    const doc = toSlots("<p>A <strong>luxury</strong> villa.</p>");
    const out = fromSlots(doc, ["فيلا ⟦m0⟧فاخرة⟦m1⟧."]);
    expect(out).toBe("<p>فيلا <strong>فاخرة</strong>.</p>");
  });

  it("re-encodes text but not the restored tags", () => {
    // Encoding the whole string would turn <strong> back into &lt;strong&gt;.
    const doc = toSlots("<p>A <strong>b</strong> c</p>");
    const out = fromSlots(doc, ["س & ص ⟦m0⟧ع⟦m1⟧"]);
    expect(out).toBe("<p>س &amp; ص <strong>ع</strong></p>");
  });

  it("keeps the English for a block that was rejected", () => {
    // Per-block fallback: a partly translated description is acceptable, a
    // mangled one is not.
    const doc = toSlots("<p>First.</p><p>Second.</p>");
    expect(fromSlots(doc, ["الأول.", null])).toBe("<p>الأول.</p><p>Second.</p>");
  });

  it("drops an out-of-range marker rather than printing it", () => {
    // A literal "⟦m9⟧" on a public page is worse than a missing <em>.
    const doc = toSlots("<p>A <em>b</em></p>");
    expect(fromSlots(doc, ["ا ⟦m0⟧ب⟦m1⟧ ⟦m9⟧"])).toBe("<p>ا <em>ب</em> </p>");
  });
});

describe("marker integrity", () => {
  const doc = toSlots("<p>A <strong>luxury</strong> villa</p>");
  const slot = doc.slots[0];

  it("accepts markers that moved", () => {
    expect(markIssues(slot, "⟦m0⟧فاخرة⟦m1⟧ فيلا")).toEqual([]);
  });

  it("catches a dropped marker", () => {
    expect(markIssues(slot, "فيلا فاخرة")).toContain(
      "formatting marker ⟦m0⟧ dropped",
    );
  });

  it("catches an invented marker", () => {
    expect(markIssues(slot, "⟦m0⟧ا⟦m1⟧ ⟦m5⟧")).toContain(
      "formatting marker ⟦m5⟧ invented",
    );
  });

  it("catches a duplicated marker", () => {
    // Two <strong> opens and one close is markup that no longer nests.
    expect(markIssues(slot, "⟦m0⟧ا⟦m0⟧ب⟦m1⟧")).toContain(
      "a formatting marker was duplicated",
    );
  });

  it("catches a close arriving before its open", () => {
    expect(markIssues(slot, "⟦m1⟧فاخرة⟦m0⟧")).toContain(
      "formatting markers are interleaved — ⟦m1⟧ closes out of order",
    );
  });

  it("does not demand an order for an unpaired marker", () => {
    // <br> has no closer, so there is nothing for it to cross.
    const br = toSlots("<p>one<br>two</p>").slots[0];
    expect(marksIn(br.text)).toEqual([0]);
    expect(markIssues(br, "اثنان⟦m0⟧واحد")).toEqual([]);
  });

  it("catches interleaved pairs that each look fine on their own", () => {
    // The defect adversarial review found: checking each pair against only
    // itself accepts this and splices <strong>a <em>b</strong> c</em>, which
    // is not markup at all. Both pairs are individually in order.
    // m0=<strong> m1=<em> m2=</em> m3=</strong>. Closing the strong before
    // the em it contains is what produces <strong>a <em>b</strong> c</em>.
    const nested = toSlots("<p>A <strong>very <em>luxurious</em></strong> villa.</p>")
      .slots[0];
    expect(markIssues(nested, "⟦m0⟧فاخرة ⟦m1⟧جدا⟦m3⟧ للغاية⟦m2⟧")).toEqual([
      "formatting markers are interleaved — ⟦m3⟧ closes out of order",
    ]);
  });

  it("still accepts genuinely nested pairs", () => {
    const nested = toSlots("<p>A <strong>very <em>luxurious</em></strong> villa.</p>")
      .slots[0];
    // Same markers, properly nested: the em closes before the strong does.
    expect(markIssues(nested, "⟦m0⟧فاخرة ⟦m1⟧جدا⟦m2⟧ للغاية⟦m3⟧ فيلا")).toEqual([]);
  });
});

describe("inputs that silently corrupted the document before", () => {
  it("keeps an href containing > inside the tag, away from the model", () => {
    // TAG_RE's [^>]* stopped at the first > even inside a quoted attribute,
    // splitting the anchor: the model was sent `b">this`, and a translation
    // that moved the markers dropped that fragment and left the anchor
    // pointing at a different URL, with markIssues reporting nothing.
    const html =
      '<p>See <a target="_blank" href="https://bazar.ae/x?q=a>b">this</a>.</p>';
    const doc = toSlots(html);
    expect(doc.slots[0].text).toBe("See ⟦m0⟧this⟦m1⟧.");
    expect(doc.slots[0].text).not.toContain("bazar.ae");
    expect(doc.slots[0].marks[0]).toContain('href="https://bazar.ae/x?q=a>b"');
    expect(fromSlots(doc, ["⟦m0⟧هذا⟦m1⟧ انظر."])).toBe(
      '<p><a target="_blank" href="https://bazar.ae/x?q=a>b">هذا</a> انظر.</p>',
    );
  });

  it("does not send a storage media key to a translation model", () => {
    // Same root cause, via the blog's figure node: the alt field is free text
    // a person types, so a > in it is entirely ordinary.
    const doc = toSlots(
      '<figure><img src="/x.png" alt="Kitchen > dining" data-media-key="blog/x.png"><figcaption>Caption.</figcaption></figure>',
    );
    for (const slot of doc.slots) {
      expect(slot.text).not.toContain("data-media-key");
      expect(slot.text).not.toContain("blog/x.png");
    }
  });

  it("keeps escaped tag text as text, even beside a real tag of that name", () => {
    // encodeSlotText used to find marks by matching their raw text. The
    // author's visible "&lt;strong&gt;" decodes to the characters <strong>,
    // matched, was left un-encoded, and shipped as live markup — an extra
    // unclosed tag on a published page.
    const doc = toSlots("<p>Use &lt;strong&gt; for a <strong>bold</strong> claim.</p>");
    expect(fromSlots(doc, ["استخدم <strong> لـ ⟦m0⟧عريض⟦m1⟧."])).toBe(
      "<p>استخدم &lt;strong&gt; لـ <strong>عريض</strong>.</p>",
    );
  });

  it("leaves a block alone when the author typed the marker syntax", () => {
    // "⟦m0⟧" in real text was read as a marker: deleted outright, or turned
    // into a duplicate opening tag when the index collided with a real one.
    const doc = toSlots("<p>Type ⟦m0⟧ to continue, then click <strong>Save</strong>.</p>");
    expect(doc.slots).toHaveLength(0);
    expect(doc.skipped).toBe(1);
    // Nothing to translate means nothing to break: the block keeps its English.
    expect(fromSlots(doc, [])).toBe(
      "<p>Type ⟦m0⟧ to continue, then click <strong>Save</strong>.</p>",
    );
  });

  it("also refuses a block carrying the content-mask namespace", () => {
    // ⟦0⟧ is what mask() uses for prices, so the same collision applies.
    expect(toSlots("<p>Press ⟦0⟧ to see the price.</p>").skipped).toBe(1);
  });

  it("normalises an ampersand the model re-escaped", () => {
    // Models re-escape. Without this the output is encoded twice and the page
    // renders the literal text "&amp;".
    expect(normaliseModelEntities("بن &amp; شركاه")).toBe("بن & شركاه");
    const doc = toSlots("<p>Ben &amp; Co. and a <strong>villa</strong>.</p>");
    expect(
      fromSlots(doc, [normaliseModelEntities("بن &amp; شركاه و ⟦m0⟧فيلا⟦m1⟧.")]),
    ).toBe("<p>بن &amp; شركاه و <strong>فيلا</strong>.</p>");
  });
});
