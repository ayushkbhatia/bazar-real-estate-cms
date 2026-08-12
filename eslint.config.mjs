import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Honour the `_`-prefix convention for intentionally-unused bindings —
      // unused args, destructure-to-omit rest siblings, caught errors. The
      // Next preset leaves these ignore patterns unset, so `_req`, `_col`,
      // `{ uid: _uid, ...rest }` etc. were all flagged despite the convention.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      // react-hook-form's `useForm().watch()` returns a non-memoizable
      // function, so the React Compiler skips every form component and this
      // rule fires on each one. RHF is our chosen forms library (see
      // CLAUDE.md) — the note is pure noise, not an actionable defect.
      "react-hooks/incompatible-library": "off",
    },
  },
  {
    // The landing-page renderer and its adapters must stay data-free.
    //
    // Every query a campaign page needs is issued once, up front, by
    // `loadLandingData` — see lib/page-builder/data.ts. A block that reaches
    // for a query module itself turns one page into one round-trip per
    // section, and none of the catalogue query modules are React-cached, so
    // nothing would collapse them. Reaching for `next/headers` or the
    // cookie-aware Supabase client is worse still: it makes /lp/[slug]
    // dynamic, so that fan-out runs per request instead of per revalidation.
    //
    // A convention would not survive a year of edits. This will.
    //
    // Scoped to the renderer and the adapters, not to the whole route: the
    // route's own page.tsx is exactly where the loading is supposed to happen.
    // (It also can't be excluded by glob — `[slug]` is a character class to
    // minimatch, so a path override naming it would never match.)
    files: ["app/(public)/lp/**/_render.tsx", "lib/page-builder/adapters.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next/headers",
              message:
                "Reading headers/cookies makes /lp/[slug] dynamic and drops it out of ISR.",
            },
            {
              name: "@/lib/supabase/server",
              message:
                "Use the batched loader in lib/page-builder/data.ts; the cookie-aware client breaks ISR.",
            },
            {
              name: "@/lib/device",
              message:
                "Landing pages are one responsive tree — no UA sniffing. It would also break ISR.",
            },
          ],
          patterns: [
            {
              group: ["@/lib/queries/*"],
              // page.tsx does the loading; the renderer and adapters must not.
              allowTypeImports: true,
              message:
                "Blocks declare their needs (BlockDef.needs) and read from LandingData. Fetching here is one round-trip per section.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
