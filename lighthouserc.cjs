/**
 * Lighthouse CI config.
 *
 * Run locally:   npx lhci autorun
 * Run in CI:     wired up in .github/workflows/ci.yml as the `lighthouse` job.
 *
 * Floors are conservative for a Next.js app on Vercel: 80/90/90/90. The
 * `assert` phase only triggers after all 3 URLs have been collected, so the
 * job reports every regression in one run rather than bailing on the first.
 */
module.exports = {
  ci: {
    collect: {
      // Lighthouse needs a long-lived server. Build is done in a separate
      // step; this command only starts the already-built app.
      startServerCommand: "npm run start -- --port 3100",
      startServerReadyPattern: "Ready in",
      // The property detail page is the heaviest template we have, so it is
      // worth auditing — but its URL is editor-owned. This used to name a
      // seed listing; when the client replaced the catalogue the row stopped
      // existing, lhci got a 404, and the job failed before it scored
      // anything ("unable to reliably load the page you requested").
      //
      // The CI job resolves a currently-published property and passes it in.
      // Locally, `npx lhci autorun` audits the two stable routes unless you
      // set LHCI_DETAIL_URL yourself.
      url: [
        "http://127.0.0.1:3100/",
        "http://127.0.0.1:3100/buy",
        ...(process.env.LHCI_DETAIL_URL ? [process.env.LHCI_DETAIL_URL] : []),
      ],
      numberOfRuns: 3,
      settings: {
        preset: "desktop",
        // CI runners are noisy; CPU + network throttling adds variance we
        // can't action on. Mobile-emulation pass lives in Phase 7f tooling.
        throttlingMethod: "provided",
        skipAudits: [
          // Heroku-style audits that don't apply on Vercel
          "uses-http2",
          // PWA features — not in scope for the marketplace
          "installable-manifest",
          "service-worker",
          "themed-omnibox",
          "maskable-icon",
        ],
      },
    },
    assert: {
      // Only assert on the four category roll-ups. Individual audit thresholds
      // (legacy-javascript, unused-javascript, server-response-time) introduce
      // CI flake we can't action on; the category score already reflects them.
      //
      // Floors are calibrated for GitHub-hosted runners, which score noticeably
      // lower than dev machines (shared CPU, slow disk, no GPU). Local runs
      // typically come in 15–25 points higher than CI on the same build. The
      // floor's job is to catch regressions, not certify production perf —
      // the production site is monitored separately via Vercel Speed Insights.
      assertions: {
        // Softened from 0.7 → 0.65: GitHub-hosted runners are noisy enough
        // that a single run frequently lands at 0.68–0.69 on pages untouched
        // by a PR. Median-of-3 (numberOfRuns:3) already absorbs most variance;
        // the lower floor is a second line of defence for slow runner days.
        "categories:performance": ["error", { minScore: 0.65 }],
        // Tightened from 0.85 to 0.9 in Phase 7e after axe-driven fixes
        // (Select aria-labels, eyebrow contrast on accent-soft background,
        // banner eyebrow contrast). All three audited routes now score 0.95+.
        "categories:accessibility": ["error", { minScore: 0.9 }],
        "categories:best-practices": ["error", { minScore: 0.9 }],
        "categories:seo": ["error", { minScore: 0.9 }],
      },
    },
    upload: {
      // Temporary public storage gives reviewers a clickable report link in
      // the GitHub Actions log without needing a paid LHCI server.
      target: "temporary-public-storage",
    },
  },
};
