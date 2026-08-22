/**
 * Lighthouse CI — mobile pass.
 *
 * Run locally:   npx lhci autorun --config=./lighthouserc.mobile.cjs
 * Run in CI:     the `lighthouse-mobile` job in .github/workflows/ci.yml
 *
 * This is the "Phase 7f tooling" that `lighthouserc.cjs` deferred and never
 * shipped. The desktop config runs `preset: "desktop"` with
 * `throttlingMethod: "provided"` — i.e. no throttling at all — so a page can
 * pass its 0.65 performance floor comfortably while a phone on 4G downloads
 * ~37 MB of hero video and ~1.8 MB of MapLibre it will never render. Neither
 * of those is visible to any existing gate.
 *
 * Kept as a separate file rather than a second `collect` block in the desktop
 * config because lhci applies one `settings` object per run: desktop and
 * mobile need different presets, different throttling and different floors,
 * and merging them would mean asserting mobile numbers against desktop
 * budgets.
 */

/**
 * Same URL contract as the desktop config: two stable routes, plus an
 * editor-resolved detail page when CI can find one. The catalogue is
 * editor-owned, so a hard-coded listing 404s the day it is unpublished —
 * that already broke this job once (see lighthouserc.cjs).
 */
const urls = [
  "http://127.0.0.1:3100/",
  "http://127.0.0.1:3100/buy",
  ...(process.env.LHCI_AUDIT_AR
    ? ["http://127.0.0.1:3100/ar", "http://127.0.0.1:3100/ar/buy"]
    : []),
  ...(process.env.LHCI_DETAIL_URL ? [process.env.LHCI_DETAIL_URL] : []),
];

module.exports = {
  ci: {
    collect: {
      startServerCommand: "npm run start -- --port 3100",
      startServerReadyPattern: "Ready in",
      url: urls,
      numberOfRuns: 3,
      settings: {
        /*
         * No `preset` key here, deliberately — and it is a trap worth naming.
         * Lighthouse accepts only "perf" | "experimental" | "desktop"; there
         * is no "mobile" preset, because MOBILE IS THE DEFAULT. A Moto-G-class
         * CPU throttle and simulated slow 4G are what you get by saying
         * nothing. `lighthouserc.cjs` opts *out* of that with
         * `preset: "desktop"` + `throttlingMethod: "provided"`.
         *
         * Passing `preset: "mobile"` fails the run outright with
         * `Invalid values: Argument: preset, Given: "mobile"` — before it
         * scores anything, which is the same silent-failure shape that broke
         * this job when the detail-page URL 404'd.
         *
         * So: default emulation, default simulated throttling. That throttling
         * is the entire point of the file — the defect class it exists to
         * catch is bytes-over-cellular, invisible to an unthrottled run.
         */
        skipAudits: [
          "uses-http2",
          "installable-manifest",
          "service-worker",
          "themed-omnibox",
          "maskable-icon",
        ],
      },
    },
    assert: {
      assertions: {
        /*
         * Performance lands NON-BLOCKING ("warn") on purpose.
         *
         * Measured baseline, median of 3 on a fast local machine:
         *
         *     /                 71    (LCP 7.4s — the 18.5 MB hero video)
         *     /buy              78    (LCP 6.0s)
         *     /p/<listing>      77    (LCP 5.9s)
         *
         * GitHub runners score noticeably lower than a dev machine — the
         * desktop config's own comment puts local runs 15-25 points high — so
         * a floor set from these numbers would block on runner noise alone.
         * Read the real minimum off three CI runs, then flip this to "error"
         * with a floor ~5 points under it. Deliberate follow-up, not an
         * oversight.
         *
         * 0.5 is a floor-of-the-floor: it catches something falling off a
         * cliff without pretending to be calibrated.
         */
        "categories:performance": ["warn", { minScore: 0.5 }],

        /*
         * These three carry over from desktop at the same floors. They are
         * layout- and markup-driven rather than throughput-driven, so a phone
         * viewport should not move them much — and if it does, that is exactly
         * the regression worth knowing about. Accessibility in particular
         * scans DIFFERENT markup here: the phone renders the mobile tree, and
         * e2e/a11y.spec.ts has never run at a phone viewport either.
         */
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "categories:best-practices": ["error", { minScore: 0.9 }],
        "categories:seo": ["error", { minScore: 0.9 }],

        /*
         * Byte budgets — the assertions with teeth.
         *
         * A category score absorbs a huge asset behind runner noise; a byte
         * budget cannot. Each of these would have caught a real finding on its
         * own, and both are content-independent, so an editor publishing a
         * listing cannot move them.
         *
         * Thresholds sit just ABOVE today's measured numbers, so this lands
         * green and ratchets DOWN as Phase 6 fixes land. A budget that starts
         * red gets ignored, same as any other gate.
         *
         * Measured, median of 3:
         *
         *   media   /            18,923 KB   ← the CMS-uploaded hero video
         *           /buy                  0
         *           /p/<listing>          0
         *   script  /               457 KB
         *           /buy              456 KB
         *           /p/<listing>      746 KB   ← MapLibre, statically imported
         *
         * Note lhci counts a URL once, so `media` here reads 18.5 MB rather
         * than the ~37 MB a real phone transfers (the clip is fetched twice —
         * cause unresolved, tracked in Phase 6). The budget still does its job:
         * it catches the asset growing.
         *
         * After Phase 6, media on `/` should drop by an order of magnitude and
         * script on the detail route by roughly 300 KB. Tighten both then.
         */
        "resource-summary:media:size": ["error", { maxNumericValue: 20_000_000 }],
        "resource-summary:script:size": ["error", { maxNumericValue: 1_000_000 }],
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};
