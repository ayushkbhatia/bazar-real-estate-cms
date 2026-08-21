import { describe, it, expect } from "vitest";
import { entryLogo, mergeDirectory, initials } from "./_directory";
import { DEVELOPERS, type DeveloperDir } from "@/lib/developers/directory-data";
import type { DeveloperListEntry } from "@/lib/queries/developers-extras";

const partner: DeveloperDir = {
  slug: "aldar",
  name: "Aldar Properties",
  blurb: "Abu Dhabi's largest master-developer.",
  logo: "/developers/aldar.png",
  w: 600,
  h: 600,
};

/**
 * `name_en` defaults to whatever `name` ends up as, so an existing case reads
 * exactly as it did. A case that sets them apart — an Arabic display name over
 * an English identity — is what the fold cases below need, and passing
 * `name_en` explicitly is how they get it.
 */
const row = (over: Partial<DeveloperListEntry> = {}): DeveloperListEntry => {
  const base = {
    id: "d1",
    slug: "ramhan-developments",
    name: "Ramhan Developments",
    founded_year: null,
    description: null,
    logo_url: null,
    published: true,
    ...over,
  };
  return { ...base, name_en: over.name_en ?? base.name };
};

describe("mergeDirectory", () => {
  it("shows a developer that only exists in the catalogue", () => {
    const out = mergeDirectory([], [row()]);
    expect(out).toHaveLength(1);
    expect(out[0].slug).toBe("ramhan-developments");
    expect(out[0].inCatalogue).toBe(true);
    // No shipped art for a CMS-created developer.
    expect(out[0].trimmed).toBeNull();
    expect(out[0].master).toBeNull();
  });

  it("shows a launch partner that has no catalogue row yet", () => {
    const out = mergeDirectory([partner], []);
    expect(out).toHaveLength(1);
    expect(out[0].master?.src).toBe("/developers/aldar.png");
    expect(out[0].inCatalogue).toBe(false);
  });

  it("merges the two rather than listing a developer twice", () => {
    const out = mergeDirectory(
      [partner],
      [row({ slug: "aldar", name: "Aldar", description: "Rewritten." })],
    );
    expect(out).toHaveLength(1);
    // The row is what editors control, so it wins on name and description...
    expect(out[0].name).toBe("Aldar");
    expect(out[0].blurb).toBe("Rewritten.");
    // ...but the shipped art survives, since it can't come out of the database.
    expect(out[0].master?.src).toBe("/developers/aldar.png");
    expect(out[0].inCatalogue).toBe(true);
  });

  it("keeps the written blurb when the row has no description", () => {
    const out = mergeDirectory([partner], [row({ slug: "aldar" })]);
    expect(out[0].blurb).toBe(partner.blurb);
  });

  it("carries an uploaded logo through for a CMS-created developer", () => {
    const out = mergeDirectory(
      [],
      [row({ logo_url: "https://cdn.example/logo.png" })],
    );
    expect(out[0].uploaded).toBe("https://cdn.example/logo.png");
  });

  it("does not claim a seed fallback row is in the catalogue", () => {
    // `listDevelopers` returns `seed:`-prefixed ids when the table is
    // unreachable. Treating those as catalogue rows would advertise a
    // developer nothing can actually be filed under.
    const out = mergeDirectory([], [row({ id: "seed:ramhan-developments" })]);
    expect(out[0].inCatalogue).toBe(false);
  });

  it("sorts by name so the grid reads alphabetically", () => {
    const out = mergeDirectory(
      [partner],
      [row({ slug: "zenith", name: "Zenith" }), row({ id: "d2", name: "Aab" })],
    );
    expect(out.map((d) => d.name)).toEqual([
      "Aab",
      "Aldar Properties",
      "Zenith",
    ]);
  });

  it("keeps every shipped partner when the catalogue is empty", () => {
    expect(mergeDirectory(DEVELOPERS, [])).toHaveLength(DEVELOPERS.length);
  });

  it("collapses a partner and its row when only the slugs disagree", () => {
    // Live data: the directory ships `modon`, the catalogue row is
    // `modon-properties`. Keying on slug alone listed MODON twice — once with
    // its logo and no projects, once with initials and the real projects.
    const modon: DeveloperDir = {
      slug: "modon",
      name: "Modon Properties",
      blurb: "Government-backed large-scale communities.",
      logo: "/developers/modon.png",
      w: 600,
      h: 600,
    };
    const out = mergeDirectory(
      [modon],
      [row({ slug: "modon-properties", name: "MODON Properties" })],
    );
    expect(out).toHaveLength(1);
    // The catalogue slug wins — that's the row with the projects behind it.
    expect(out[0].slug).toBe("modon-properties");
    expect(out[0].name).toBe("MODON Properties");
    // The shipped art comes along.
    expect(out[0].master?.src).toBe("/developers/modon.png");
    expect(out[0].inCatalogue).toBe(true);
  });

  it("keeps genuinely different companies apart", () => {
    const aldar: DeveloperDir = { ...partner, slug: "aldar", name: "Aldar" };
    const out = mergeDirectory(
      [aldar],
      [row({ slug: "aldar-properties", name: "Aldar Properties" })],
    );
    expect(out.map((d) => d.name)).toEqual(["Aldar", "Aldar Properties"]);
  });

  it("does not fold two catalogue rows into each other", () => {
    // Both are real rows; neither should absorb the other just because a
    // directory entry matched one of them first.
    const out = mergeDirectory(
      [],
      [
        row({ id: "d1", slug: "taraf", name: "Taraf" }),
        row({ id: "d2", slug: "tiger-properties", name: "Tiger Properties" }),
      ],
    );
    expect(out).toHaveLength(2);
  });
});

describe("publish state", () => {
  it("carries a draft row's state onto the merged entry", () => {
    const out = mergeDirectory([partner], [row({ slug: "aldar", published: false })]);
    expect(out[0].published).toBe(false);
  });

  it("keeps a shipped entry with no row published", () => {
    // Nothing can unpublish what has no row, so the grid must not drop it.
    expect(mergeDirectory([partner], [])[0].published).toBe(true);
  });

  it("does not let a seed fallback row mark a partner draft", () => {
    // `seed:` rows appear when the table is unreachable. Treating one as the
    // source of publish state would blank the grid during an outage.
    const out = mergeDirectory(
      [partner],
      [row({ id: "seed:aldar", slug: "aldar", published: false })],
    );
    expect(out[0].published).toBe(true);
  });
});

/**
 * The /ar collapse.
 *
 * `developerNameKey` is `slugify`, which keeps `[a-z0-9]` and nothing else, so
 * an Arabic display name reduces to the empty string. Every folded row shared
 * that one key: rows matched each other instead of their directory partner,
 * `imkan`/`modon`/`sobha` listed twice and `ict`/`nakheel`/`samana` vanished
 * from the grid. The match runs on `name_en` now, and the empty key is
 * rejected outright.
 */
describe("mergeDirectory under an Arabic fold", () => {
  const modonDir: DeveloperDir = {
    slug: "modon",
    name: "Modon Properties",
    blurb: "Government-backed large-scale communities.",
    logo: "/developers/modon.png",
    w: 600,
    h: 600,
  };

  const folded = (over: Partial<DeveloperListEntry>) =>
    row({ description: "وصف عربي.", ...over });

  it("still merges a superseded slug when the name is folded to Arabic", () => {
    const out = mergeDirectory(
      [modonDir],
      [
        folded({
          id: "d-modon",
          slug: "modon-properties",
          name: "مُدن العقارية",
          name_en: "MODON Properties",
        }),
      ],
    );
    expect(out).toHaveLength(1);
    expect(out[0].slug).toBe("modon-properties");
    // The shipped art survives the merge, which is the whole reason it exists.
    expect(out[0].master?.src).toBe("/developers/modon.png");
    expect(out[0].name).toBe("مُدن العقارية");
  });

  it("does not let two Arabic-named rows match each other", () => {
    const out = mergeDirectory(
      [],
      [
        folded({ id: "a", slug: "ict", name: "آي سي تي", name_en: "ICT" }),
        folded({ id: "b", slug: "nakheel", name: "نخيل", name_en: "Nakheel" }),
        folded({ id: "c", slug: "samana", name: "سامانا", name_en: "Samana" }),
      ],
    );
    // Three rows in, three entries out. Before the fix the second and third
    // resolved to the first's empty key and overwrote it.
    expect(out.map((d) => d.slug).sort()).toEqual([
      "ict",
      "nakheel",
      "samana",
    ]);
  });

  it("carries the English name onto the entry for the superseded-slug lookup", () => {
    const out = mergeDirectory(
      [modonDir],
      [
        folded({
          id: "d-modon",
          slug: "modon-properties",
          name: "مُدن العقارية",
          name_en: "MODON Properties",
        }),
      ],
    );
    expect(out[0].name_en).toBe("MODON Properties");
  });
});

describe("entryLogo", () => {
  const base = mergeDirectory([partner], [])[0];

  it("prefers an uploaded logo over the shipped art", () => {
    // The whole point of the record editor's logo field. Before this, an
    // operator could upload a mark for a launch partner, save, and watch the
    // page keep drawing the PNG baked into the repo.
    const withUpload = { ...base, uploaded: "https://cdn.example/new.png" };
    expect(entryLogo(withUpload)?.src).toBe("https://cdn.example/new.png");
  });

  it("falls back to the trimmed art, then the padded master canvas", () => {
    expect(entryLogo(base)?.src).toBe("/developers/trimmed/aldar.png");
    expect(entryLogo({ ...base, trimmed: null })?.src).toBe(
      "/developers/aldar.png",
    );
  });

  it("returns null when there is no art at all, so initials draw", () => {
    expect(
      entryLogo({ ...base, trimmed: null, master: null, uploaded: null }),
    ).toBeNull();
    expect(entryLogo(null)).toBeNull();
  });
});

describe("initials", () => {
  it("takes the first letter of the first two words", () => {
    expect(initials("Ramhan Developments")).toBe("RD");
  });

  it("handles a one-word name", () => {
    expect(initials("Emaar")).toBe("E");
  });

  it("survives stray whitespace rather than emitting a space", () => {
    expect(initials("  Nine   Yards  ")).toBe("NY");
  });
});
