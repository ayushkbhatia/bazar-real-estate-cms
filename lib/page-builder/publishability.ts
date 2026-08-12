/**
 * Can this landing page go live?
 *
 * Pure and dependency-free, in the shape `lib/publishability.ts` established:
 * `blockers` is why the action refuses, `checks` is the same facts laid out for
 * the publish card so an editor can see what's missing before pressing
 * anything. One function, two consumers, no chance of the button and the
 * server disagreeing.
 *
 * Two things are deliberately NOT checked:
 *
 *  - Contrast. Every colour choice in the catalogue is a closed `select`, so
 *    there is no way for an editor to put white on white. Checking it here
 *    would be theatre.
 *  - Whether a pick still resolves. `lib/master-pages/index.ts` already rules
 *    on this: a record can be unpublished after the fact, and the renderer
 *    drops picks it can't resolve. Blocking publish on it would mean an
 *    unrelated listing going off-market takes a campaign page down with it.
 */

import {
  isListField,
  isMediaField,
  validateFieldValues,
  type FieldDef,
  type ImageValue,
  type ItemValue,
  type SectionValues,
  type ValidationIssue,
} from "@/lib/master-pages";
import {
  LANDING_QUERY_BUDGET,
  LANDING_SLUG_RE,
  isReservedLandingSlug,
  type ResolvedBlock,
} from "./types";

export type PublishCheck = { label: string; passed: boolean };

export type LandingPublishability = {
  ok: boolean;
  blockers: string[];
  checks: PublishCheck[];
};

export type LandingPublishInput = {
  title: string | null;
  slug: string | null;
  metaDescription: string | null;
  noindex: boolean;
  blocks: ResolvedBlock[];
  /** Every form key this build knows about — `FORM_KEYS`. */
  knownFormKeys: readonly string[];
  /** The subset currently switched on in /admin/forms. */
  enabledFormKeys: readonly string[];
};

export function evaluateLandingPublishability(
  input: LandingPublishInput,
): LandingPublishability {
  const blockers: string[] = [];
  const checks: PublishCheck[] = [];

  const add = (label: string, passed: boolean, blocker?: string) => {
    checks.push({ label, passed });
    if (!passed && blocker) blockers.push(blocker);
  };

  // 1 — title
  const title = (input.title ?? "").trim();
  add("Title is set", title.length >= 3, "Give the page a title.");

  // 2 — slug
  const slug = (input.slug ?? "").trim();
  const slugOk = LANDING_SLUG_RE.test(slug) && !isReservedLandingSlug(slug);
  add(
    "URL is valid",
    slugOk,
    isReservedLandingSlug(slug)
      ? `"${slug}" is reserved — pick another URL.`
      : "The URL must be lowercase letters, digits and hyphens, with no slashes.",
  );

  const enabled = input.blocks.filter((b) => b.enabled);
  const renderable = enabled.filter((b) => b.def !== null);
  const unknown = enabled.filter((b) => b.def === null);

  // 3 — something renders
  add(
    "Page has at least one section",
    renderable.length > 0,
    "Add a section — an empty page would publish a blank screen.",
  );

  // 4 — nothing silently missing
  add(
    "Every section is available",
    unknown.length === 0,
    unknown.length === 1
      ? `One section ("${unknown[0]?.type}") isn't available in this version of the site and wouldn't render.`
      : `${unknown.length} sections aren't available in this version of the site and wouldn't render.`,
  );

  // 5 — required copy. Runs against the stored document, because the client is
  // what produced the blank in the first place.
  const copyIssues: ValidationIssue[] = [];
  for (const block of renderable) {
    if (!block.def) continue;
    validateFieldValues(
      block.def.fields,
      block.values,
      block.def.label,
      copyIssues,
    );
  }
  add(
    "Every section's copy is filled in",
    copyIssues.length === 0,
    copyIssues.length > 0
      ? copyIssues
          .slice(0, 3)
          .map((i) => `${i.section} · ${i.field}: ${i.message}`)
          .join(" ")
      : undefined,
  );

  // 6 — heading structure. Framed as accessibility rather than taste: zero
  // means no page title in a search result and a broken screen-reader outline,
  // and two is a violation axe reports against production.
  const h1s = renderable.filter((b) => b.def?.providesH1).length;
  add(
    "Exactly one section carries the page heading",
    h1s === 1,
    h1s === 0
      ? "Add an opening section — nothing on the page carries the main heading."
      : h1s > 1
        ? "Two sections both carry the main heading. Keep one."
        : undefined,
  );

  // 7 — alt text. `image-alt` is a real axe violation, so skipping this would
  // redden CI on a content change with no commit behind it.
  const missingAlt = collectImages(renderable).filter(
    (img) => img.media_id !== null && !(img.alt ?? "").trim(),
  ).length;
  add(
    "Every photo has alt text",
    missingAlt === 0,
    missingAlt > 0
      ? `${missingAlt} photo${missingAlt === 1 ? "" : "s"} ${missingAlt === 1 ? "has" : "have"} no alt text.`
      : undefined,
  );

  // 8 — forms. A published campaign page whose only conversion point is a
  // switched-off form is exactly the failure this check earns its place for.
  const formKeys = collectFormKeys(renderable);
  const deadForms = formKeys.filter(
    (k) => !input.knownFormKeys.includes(k) || !input.enabledFormKeys.includes(k),
  );
  add(
    "Every form is live",
    deadForms.length === 0,
    deadForms.length > 0
      ? `${deadForms.join(", ")} ${deadForms.length === 1 ? "is" : "are"} switched off in Forms — the section would render empty.`
      : undefined,
  );

  // 9 — links
  const badLinks = collectLinks(renderable).filter((href) => !isUsableHref(href));
  add(
    "Every link points somewhere",
    badLinks.length === 0,
    badLinks.length > 0
      ? `Fix ${badLinks.length} link${badLinks.length === 1 ? "" : "s"}: ${badLinks.slice(0, 3).join(", ")}. Links start with "/", "https://", "mailto:" or "tel:".`
      : undefined,
  );

  // 10 — query budget. Turns an expensive page into a pre-publish error rather
  // than a line on the Supabase bill.
  const cost = renderable.reduce((sum, b) => sum + (b.def?.queryCost ?? 0), 0);
  add(
    "Within the data budget",
    cost <= LANDING_QUERY_BUDGET,
    cost > LANDING_QUERY_BUDGET
      ? `This page would run ${cost} catalogue queries every time it refreshes — the cap is ${LANDING_QUERY_BUDGET}. Remove a live-inventory section.`
      : undefined,
  );

  // Advisory only, deliberately. lib/publishability.ts:41 records why the
  // property gate dropped its own hero-image requirement: it was blocking
  // listings that were otherwise ready to go live.
  const first = renderable[0];
  checks.push({
    label: "Opens with a hero section",
    passed: first?.def?.opener === true,
  });
  checks.push({
    label: "Search visibility is decided",
    passed: input.noindex || (input.metaDescription ?? "").trim().length > 0,
  });

  return { ok: blockers.length === 0, blockers, checks };
}

// ── walkers ──────────────────────────────────────────────────────────────

function eachScalar(
  blocks: ResolvedBlock[],
  visit: (field: Exclude<FieldDef, { kind: "list" }>, value: ItemValue) => void,
) {
  for (const block of blocks) {
    if (!block.def) continue;
    for (const field of block.def.fields) {
      const value = block.values[field.key];
      if (isListField(field)) {
        const items = Array.isArray(value) ? value : [];
        for (const item of items) {
          for (const sub of field.fields) {
            visit(sub, (item as Record<string, ItemValue>)?.[sub.key] ?? null);
          }
        }
      } else {
        visit(field, (value ?? null) as ItemValue);
      }
    }
  }
}

function collectImages(blocks: ResolvedBlock[]): ImageValue[] {
  const out: ImageValue[] = [];
  eachScalar(blocks, (field, value) => {
    if (!isMediaField(field)) return;
    if (value && typeof value === "object") out.push(value as ImageValue);
  });
  return out;
}

function collectLinks(blocks: ResolvedBlock[]): string[] {
  const out: string[] = [];
  eachScalar(blocks, (field, value) => {
    if (field.kind !== "link") return;
    if (typeof value === "string" && value.trim() !== "") out.push(value.trim());
  });
  return out;
}

/** Every `form_key` the page references, deduped. */
export function collectFormKeys(blocks: ResolvedBlock[]): string[] {
  const keys = new Set<string>();
  for (const block of blocks) {
    if (!block.def) continue;
    const value = (block.values as SectionValues).form_key;
    if (typeof value === "string" && value.trim() !== "") keys.add(value.trim());
  }
  return [...keys];
}

function isUsableHref(href: string): boolean {
  return (
    href.startsWith("/") ||
    href.startsWith("https://") ||
    href.startsWith("http://") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    href.startsWith("#")
  );
}
