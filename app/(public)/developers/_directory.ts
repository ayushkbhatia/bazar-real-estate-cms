/**
 * The developer directory the public pages render.
 *
 * Two sources have to become one list. `lib/developers/directory-data.ts` is
 * the code-owned set of launch partners — it carries the trimmed logo art,
 * which lives in /public/developers and can't come out of the database. The
 * `developers` table is what every property and project actually references,
 * and it grows whenever staff add a partner from the CMS.
 *
 * Merging on slug is what stops a developer added in the CMS from being
 * invisible on /developers while its profile page, its listings and the
 * sitemap all exist. The database wins on the fields it owns (name,
 * description, logo); the directory supplies the art and the blurb it was
 * written with.
 */

import {
  listDevelopers,
  type DeveloperListEntry,
} from "@/lib/queries/developers-extras";
import { developerNameKey } from "@/lib/schemas/developer";
import { trimmedLogo, type TrimmedLogo } from "@/lib/developers/logos";
import { DEVELOPERS, type DeveloperDir } from "@/lib/developers/directory-data";

export type DirectoryEntry = {
  slug: string;
  name: string;
  blurb: string | null;
  /** Trimmed art from /public — preferred, it is optically normalised. */
  trimmed: TrimmedLogo | null;
  /** The padded master canvas that ships with a launch partner. */
  master: { src: string; w: number; h: number } | null;
  /** An operator-uploaded logo, for developers with no shipped art. */
  uploaded: string | null;
  /** True when the row exists in Postgres — i.e. listings can reference it. */
  inCatalogue: boolean;
};

function fromDir(d: DeveloperDir): DirectoryEntry {
  return {
    slug: d.slug,
    name: d.name,
    blurb: d.blurb,
    trimmed: trimmedLogo(d.slug) ?? null,
    master: { src: d.logo, w: d.w, h: d.h },
    uploaded: null,
    inCatalogue: false,
  };
}

/**
 * Fold catalogue rows into the code-owned set. Pure, so the precedence rules
 * are testable without a database.
 *
 * Matching is on slug **or** normalised name, because the two sources disagree
 * about slugs for companies they both carry: the directory ships `modon` and
 * the catalogue row is `modon-properties`, likewise `imkan` / `imkan-properties`.
 * Keying on slug alone listed those developers twice — once with its logo and
 * no projects, once with initials and the real projects behind it.
 *
 * When they match, the entry lands under the **catalogue** slug: that's the row
 * every property and project references, so it's the profile page that has
 * anything to show. The directory slug keeps working — `getDeveloperDir` still
 * resolves it — so no existing link breaks.
 */
export function mergeDirectory(
  dir: DeveloperDir[],
  rows: DeveloperListEntry[],
): DirectoryEntry[] {
  const bySlug = new Map<string, DirectoryEntry>(
    dir.map((d) => [d.slug, fromDir(d)]),
  );
  // Second index over the same entries, so a row can find its partner by name.
  const keyToSlug = new Map<string, string>(
    dir.map((d) => [developerNameKey(d.name), d.slug]),
  );

  for (const row of rows) {
    // `listDevelopers` falls back to seed rows with a `seed:` id when the table
    // is unreachable. Those are not catalogue rows and must not claim to be.
    const inCatalogue = !row.id.startsWith("seed:");
    const matchedSlug = bySlug.has(row.slug)
      ? row.slug
      : keyToSlug.get(developerNameKey(row.name));
    const existing = matchedSlug ? bySlug.get(matchedSlug) : undefined;

    if (existing && matchedSlug) {
      bySlug.delete(matchedSlug);
      bySlug.set(row.slug, {
        ...existing,
        slug: row.slug,
        // The row is what editors control, so its name and description win —
        // but a blank description keeps the written blurb rather than emptying
        // the card.
        name: row.name,
        blurb: row.description ?? existing.blurb,
        uploaded: row.logo_url,
        inCatalogue: existing.inCatalogue || inCatalogue,
      });
      keyToSlug.set(developerNameKey(row.name), row.slug);
      continue;
    }

    bySlug.set(row.slug, {
      slug: row.slug,
      name: row.name,
      blurb: row.description,
      trimmed: null,
      master: null,
      uploaded: row.logo_url,
      inCatalogue,
    });
    keyToSlug.set(developerNameKey(row.name), row.slug);
  }

  return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Every developer worth showing, alphabetical.
 *
 * Falls back to the code-owned set alone when Supabase is unreachable, so the
 * grid never empties out.
 */
export async function listDirectory(): Promise<DirectoryEntry[]> {
  let rows: DeveloperListEntry[] = [];
  try {
    rows = await listDevelopers();
  } catch {
    rows = [];
  }
  return mergeDirectory(DEVELOPERS, rows);
}

/**
 * The directory entry behind one profile page.
 *
 * Two slugs can reach the same developer: the catalogue slug the merged grid
 * links to (`modon-properties`) and the shipped directory slug that predates
 * it (`modon`). Both have to render, and both have to find the logo art — the
 * index showing a logo while the profile showed initials was the giveaway that
 * a plain `getDeveloperDir(slug)` lookup wasn't enough.
 *
 * Returns null only when neither source knows the slug.
 */
export async function findDirectoryEntry(
  slug: string,
): Promise<DirectoryEntry | null> {
  const merged = await listDirectory();
  const hit = merged.find((d) => d.slug === slug);
  if (hit) return hit;

  const dir = DEVELOPERS.find((d) => d.slug === slug);
  if (!dir) return null;

  // A directory slug whose entry moved to its catalogue slug during the merge.
  // Return the merged entry rather than the directory one: its `slug` is where
  // the grid now links and where the projects are, so the page can canonicalise
  // to it instead of leaving two URLs competing for the same developer.
  const key = developerNameKey(dir.name);
  return merged.find((d) => developerNameKey(d.name) === key) ?? fromDir(dir);
}

/**
 * The logo a surface should draw for one entry, or null for initials.
 *
 * Upload first. It used to come last, behind the shipped PNGs, which made the
 * logo field on the record editor a no-op for exactly the 30 developers most
 * likely to want a refreshed mark — the operator uploaded one, saved, and the
 * page kept drawing the file baked into the repo.
 */
export function entryLogo(
  entry: DirectoryEntry | null,
): { src: string; w: number; h: number } | null {
  if (!entry) return null;
  if (entry.uploaded) return { src: entry.uploaded, w: 240, h: 240 };
  if (entry.trimmed) return entry.trimmed;
  return entry.master;
}

/** Initials mark for a developer with no logo art of any kind. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}
