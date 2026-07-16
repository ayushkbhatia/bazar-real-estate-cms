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
]);

export default eslintConfig;
