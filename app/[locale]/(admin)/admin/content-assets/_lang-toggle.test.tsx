import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import {
  NEXT_INTERCEPTION_MARKER_PREFIX,
  NEXT_QUERY_PARAM_PREFIX,
} from "next/dist/lib/constants";
import { LEGACY_LANG_PARAM } from "@/lib/legacy-redirects";
import { SETLANG_PARAM } from "@/lib/i18n/routing";
import { LangToggle, LANG_PARAM, langFrom, withLang } from "./_lang-toggle";

describe("withLang", () => {
  it("leaves English alone and appends Arabic", () => {
    expect(withLang("/admin/content-assets", "en")).toBe("/admin/content-assets");
    expect(withLang("/admin/content-assets", "ar")).toBe(
      `/admin/content-assets?${LANG_PARAM}=ar`,
    );
  });

  it("merges into a URL that already has a query", () => {
    expect(withLang("/admin/content-assets?view=outreach", "ar")).toBe(
      `/admin/content-assets?view=outreach&${LANG_PARAM}=ar`,
    );
  });

  it("round-trips through langFrom", () => {
    expect(langFrom({ [LANG_PARAM]: "ar" })).toBe("ar");
    expect(langFrom({ [LANG_PARAM]: ["ar"] })).toBe("ar");
    expect(langFrom({})).toBe("en");
    expect(langFrom({ [LANG_PARAM]: "fr" })).toBe("en");
  });
});

describe("LangToggle", () => {
  /**
   * The rendered `href`, not the helper that builds it — this is the attribute
   * the marketing manager's click actually follows, and the bug was that it
   * pointed at a URL the proxy threw away.
   */
  it("points each button at the same screen in the other language", () => {
    render(
      <LangToggle
        lang="en"
        hrefFor={(l) => withLang("/admin/content-assets", l)}
      />,
    );
    expect(screen.getByRole("link", { name: "العربية" })).toHaveAttribute(
      "href",
      `/admin/content-assets?${LANG_PARAM}=ar`,
    );
    expect(screen.getByRole("link", { name: "English" })).toHaveAttribute(
      "href",
      "/admin/content-assets",
    );
  });

  it("marks the language you are on", () => {
    render(
      <LangToggle
        lang="ar"
        hrefFor={(l) => withLang("/admin/content-assets", l)}
      />,
    );
    expect(screen.getByRole("link", { name: "العربية" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByRole("link", { name: "English" })).not.toHaveAttribute(
      "aria-current",
    );
  });
});

/**
 * The toggle only works if every link goes through `withLang`.
 *
 * A hand-written `?lang=ar` looks identical in review and is deleted in flight
 * by the proxy's WordPress clean-up — see `proxy.lang-param.test.ts`. This
 * walks the screens rather than trusting that nobody types it again.
 */
describe("no screen hand-writes the poisoned parameter", () => {
  const ROOT = import.meta.dirname;

  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return walk(full);
      return /\.tsx?$/.test(entry) ? [full] : [];
    });
  }

  it("uses no `lang=` query parameter anywhere under content assets", () => {
    const offenders = walk(ROOT)
      // This module and its test name the poisoned parameter on purpose, in
      // the prose that explains why nothing else may.
      .filter((file) => !/_lang-toggle\./.test(file))
      .filter((file) => /[?&]lang=/.test(readFileSync(file, "utf8")));
    expect(offenders.map((f) => f.slice(ROOT.length + 1))).toEqual([]);
  });
});

/**
 * An editor that holds the wording in state must be keyed on the language.
 *
 * Switching language is a client-side navigation. The server re-renders the
 * page with the other language's columns, but an editor sitting in the same
 * position is the same React instance, so its `useState(initial)` — seeded
 * once, on first mount — keeps the wording it started with. The toggle moves,
 * `dir` flips, and the fields still show the language you just left. That is
 * what reached us as "the Arabic button does nothing".
 *
 * It is not only cosmetic: saving from that screen writes the English text
 * into `subject_ar`/`body_ar`, so the Arabic twin fills up with English and
 * sends that to Arabic leads.
 *
 * The rule is checked at the mount site rather than inside the component,
 * because `key` is a parent's decision and invisible from within.
 */
describe("every stateful editor is keyed on the language", () => {
  const ROOT = import.meta.dirname;

  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) return walk(full);
      return /\.tsx$/.test(entry) ? [full] : [];
    });
  }

  /** `_thing-editor.tsx` → `<ThingEditor`, the tag its page mounts. */
  function editorTags(): string[] {
    return walk(ROOT)
      .filter((f) => /_[a-z-]*editor\.tsx$/.test(f) && !/\.test\./.test(f))
      .flatMap((f) => {
        const src = readFileSync(f, "utf8");
        // Two conditions, and both are the hazard: it is handed a language,
        // and it seeds state from its props. The outreach editor has no
        // Arabic twin and so no toggle to survive — it is not in scope.
        if (!/lang: EmailLocale/.test(src)) return [];
        if (!/useState[^\n]*\(\s*initial/.test(src)) return [];
        const exported = src.match(/export function ([A-Z]\w+)/);
        return exported ? [exported[1]!] : [];
      });
  }

  it("finds the editors it is meant to be checking", () => {
    // A vacuous pass here would wave through the next editor added.
    expect(editorTags().sort()).toEqual(["FormReplyEditor", "SystemEmailEditor"]);
  });

  it("mounts each of them with key={lang}", () => {
    const offenders: string[] = [];
    for (const tag of editorTags()) {
      for (const file of walk(ROOT)) {
        const src = readFileSync(file, "utf8");
        const open = src.match(new RegExp(`<${tag}\\b[^>]*`, "s"));
        if (!open) continue;
        if (!/key=\{lang\}/.test(open[0])) {
          offenders.push(`${file.slice(ROOT.length + 1)} mounts <${tag}>`);
        }
      }
    }
    expect(
      offenders,
      `Mounted without key={lang}:\n${offenders.join("\n")}\n\n` +
        `Without it the editor survives the language switch with the other ` +
        `language's wording in its fields — and saves it into that column.`,
    ).toEqual([]);
  });
});

/**
 * The name has to survive Vercel, and nothing local can show whether it does.
 *
 * On Vercel, Next runs in minimal mode, and `filterInternalQuery`
 * (next/dist/server/server-utils.js) deletes every query key that shares a
 * name with a route parameter — scrubbing what its own router injected, with
 * no way to tell a visitor's key from its own. The root segment is
 * `app/[locale]`, so `?locale=ar` was deleted before any page read it, and the
 * toggle rendered English in production while passing every test here: `next
 * dev` and `next start` never enter minimal mode.
 *
 * So the check is structural. It reads every dynamic segment off disk rather
 * than listing them, and takes the other reserved names from where they are
 * defined, so a future `app/.../[language]/` folder or a renamed proxy
 * parameter fails here instead of in the CMS.
 */
describe("the language parameter survives Vercel", () => {
  const APP_MARKER = `${sep}app${sep}`;
  const APP = import.meta.dirname.slice(
    0,
    import.meta.dirname.lastIndexOf(APP_MARKER) + APP_MARKER.length - 1,
  );

  function segmentNames(dir: string, out = new Set<string>()): Set<string> {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (!statSync(full).isDirectory()) continue;
      // [x], [...x], [[...x]] — the name inside is the route parameter.
      const m = entry.match(/^\[{1,2}(?:\.\.\.)?([^\]]+)\]{1,2}$/);
      if (m) out.add(m[1]!);
      segmentNames(full, out);
    }
    return out;
  }

  it("is not the name of any route segment", () => {
    const names = segmentNames(APP);
    // Non-vacuity: the walk must find the segment that caused the bug.
    expect(names.has("locale")).toBe(true);
    expect(
      [...names].filter((n) => n === LANG_PARAM),
      `\`?${LANG_PARAM}=\` shares a name with a route segment, and on Vercel ` +
        `Next deletes it from the query before the page reads it.`,
    ).toEqual([]);
  });

  it("is none of the names the proxy strips or consumes", () => {
    expect(LANG_PARAM).not.toBe(LEGACY_LANG_PARAM);
    expect(LANG_PARAM).not.toBe(SETLANG_PARAM);
  });

  it("does not look like one of Next's own routing parameters", () => {
    expect(LANG_PARAM.startsWith(NEXT_QUERY_PARAM_PREFIX)).toBe(false);
    expect(LANG_PARAM.startsWith(NEXT_INTERCEPTION_MARKER_PREFIX)).toBe(false);
  });
});
