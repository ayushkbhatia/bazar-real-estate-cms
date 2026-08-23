import { test, expect, type Page } from "@playwright/test";

/**
 * The mobile regression net.
 *
 * Context: the responsive build (PRs #109-#114) argues its correctness
 * entirely through CSS breakpoints, and until this spec there was no CI job
 * running at a phone width at all — one Playwright project (Desktop Chrome)
 * and a Lighthouse config pinned to `preset: "desktop"`. The ~155 commits that
 * landed after that build re-introduced the same handful of defects because
 * nothing made the wrong thing fail. This is the thing that makes it fail.
 *
 * Four checks, deliberately staged (see GATE below): two block today, two
 * report until the phases that fix their backlog have landed. Shipping all
 * four as blocking would red-line `main` against ~77 known findings, which
 * trains everyone to ignore a red gate — the same failure mode the webServer
 * timeout comment in playwright.config.ts warns about.
 *
 * Everything here is a GEOMETRY invariant, never a content assertion. CI runs
 * against the live production CMS, so an editor unpublishing a listing must
 * never redden this job. No copy, no counts, no named subjects.
 */

/** Playwright's iPhone 13 descriptor is 390px wide. */
const VIEWPORT_WIDTH = 390;

/**
 * A grid track narrower than this cannot hold the content the design puts in
 * it. Calibrated against measurement, not taste: `/developments` renders
 * 18px stat columns (content needs 34-51px), while `/careers`, the next
 * worst, sits at 67px and is merely cramped. 60px separates the two.
 */
const MIN_GRID_TRACK = 60;

/** iOS Safari zooms the viewport when a focused control is under 16px. */
const MIN_CONTROL_FONT_SIZE = 16;

/** WCAG 2.5.5 / the platform HIG both land here. */
const MIN_TOUCH_TARGET = 44;

/**
 * Staging. Flip a check to "blocking" in the PR that clears its backlog:
 *
 *   inputZoom    -> blocking at the end of Phase 2 (16px form-control sweep)
 *   touchTargets -> blocking at the end of Phase 8 (residual targets)
 *
 * A "report" check still runs and still attaches its violations to the
 * Playwright report; it just does not fail the run.
 */
const GATE = {
  overflow: "blocking",
  narrowTracks: "blocking",
  inputZoom: "report",
  touchTargets: "report",
} as const;

/**
 * Routes with a known, tracked violation of a *blocking* check.
 *
 * This is a countdown, not a config surface. Each entry names the phase that
 * deletes it. Adding one to land unrelated work is how a gate rots — fix the
 * route or move the check back to "report" for everyone.
 *
 * IT IS CURRENTLY EMPTY, and that is the point. It opened with one entry —
 * `/developments`, whose `px-12` gutters plus an ungated `grid-cols-2` plus a
 * card-internal `grid-cols-3` compounded into 18px stat columns holding
 * content that needed 34-51px. Phase 4 gave it `px-4 md:px-12` and
 * `grid-cols-1 md:grid-cols-2`; each stat now gets ~92px and the route passes
 * `narrowTracks` on its own merits. The waiver was deleted in the same change
 * that earned its deletion.
 */
const KNOWN_FAILURES: Record<string, { checks: string[]; owner: string }> = {
  // Phase 4. `px-12` + an ungated `grid-cols-2` + a card-internal
  // `grid-cols-3` compound to 18px stat columns; headings needing 119px are
  // clipped into 85px boxes. Note this route reports NO horizontal overflow —
  // it clips rather than pushes — which is exactly why `narrowTracks` exists
  // alongside `overflow`.

};

/*
 * Deliberately NOT waived: `/`.
 *
 * While repairing the overflow check (see scrollsHorizontally) the home page
 * measured 368px of real horizontal scroll — clientWidth 390, scrollWidth
 * 1928 — in three separate observations, including one inside this gate. It
 * then measured 0 across twelve consecutive runs against the same server,
 * with and without animations disabled.
 *
 * So the overflow is real when it happens and is not an artifact of the old
 * broken comparison, but it is not reliably reproducible. Two plausible
 * sources, neither confirmed: `developer-marquee.tsx`, an infinite horizontal
 * scroller whose rendered width depends on animation phase; or live CMS
 * content, since this suite reads production data and the marquee's item
 * count is editor-owned.
 *
 * It is left unwaived on purpose. Waiving it would silence the one check now
 * capable of catching it, on the strength of evidence too thin to name a
 * cause. If it is persistent, CI will say so — and that failure will be the
 * diagnosis this comment cannot provide.
 */

/**
 * Static route list — every one of these renders without a CMS subject.
 *
 * Detail pages (`/p/<slug>`, `/areas/<slug>`) are deliberately absent: they
 * need a published subject, and `e2e/_helpers.ts` exists precisely because
 * naming one makes the build fail the day an editor unpublishes it. The
 * shared templates those pages use are covered through their index routes;
 * detail-page geometry gets its own subject-discovering spec when Phase 4
 * needs it.
 *
 * `/ar` routes are included because RTL is a separate layout pass and the
 * Arabic face has different metrics — a defect can exist on one and not the
 * other.
 */
const ROUTES = [
  "/",
  "/buy",
  "/rent",
  "/off-plan",
  "/commercial",
  "/buy/search",
  "/off-plan/search",
  "/areas",
  "/developers",
  "/developments",
  "/agents",
  "/insights",
  "/guides",
  "/services",
  "/about",
  "/contact",
  "/tools/compare",
  "/tools/mortgage",
  "/tools/valuation",
  "/market-reports",
  "/legal/privacy",
  "/careers",
  "/press",
  "/partners",
  "/exclusive",
  "/new-this-week",
  "/price-drops",
  "/sitemap",
  "/ar",
  "/ar/buy",
  "/ar/buy/search",
  "/ar/areas",
  "/ar/contact",
];

type Violations = {
  overflow: string[];
  narrowTracks: string[];
  clipped: string[];
  inputZoom: string[];
  touchTargets: string[];
};

/**
 * Does the document actually scroll sideways?
 *
 * This is a GROUND-TRUTH test — scroll the page and see whether it moved —
 * and it has to be, because the obvious implementation is silently broken.
 *
 * The first version of this gate compared `documentElement.scrollWidth`
 * against `window.innerWidth`. Under Chromium's mobile emulation those two
 * numbers MOVE TOGETHER: when content overflows, the layout viewport widens to
 * fit it, so `innerWidth` inflates right alongside `scrollWidth` and the
 * difference stays ~0 whether or not the page overflows. Measured on `/`:
 *
 *     innerWidth 1560   clientWidth 390   scrollWidth 1928   → really scrolls 368px
 *     innerWidth  489   clientWidth 390   scrollWidth  489   → does not scroll   (/buy)
 *
 * So the check could never fail, and it passed 34/34 on CI by measuring
 * nothing.
 *
 * `clientWidth` (a stable 390) is the right *reference*, but comparing
 * `scrollWidth > clientWidth` false-positives on `/buy`, where the two differ
 * by 99px with no scrollability at all. Only actually scrolling distinguishes
 * them.
 *
 * Runs AFTER collect() — it moves the scroll position, which would change
 * which elements count as on-screen for the touch-target check. Resets to 0.
 */
async function scrollsHorizontally(page: Page): Promise<number> {
  return page.evaluate(() => {
    const before = window.scrollX;
    window.scrollTo(9999, window.scrollY);
    const reached = Math.round(window.scrollX);
    window.scrollTo(before, window.scrollY);
    return reached;
  });
}

/**
 * One pass over the rendered document, in the page context.
 *
 * Collected in a single `evaluate` rather than four: each walk of the DOM on a
 * heavy route costs real time, and the whole point is a gate cheap enough that
 * nobody argues for deleting it.
 */
async function collect(page: Page): Promise<Violations> {
  return page.evaluate(
    ({ MIN_GRID_TRACK, MIN_CONTROL_FONT_SIZE, MIN_TOUCH_TARGET }) => {
      const out: Violations = {
        overflow: [],
        narrowTracks: [],
        clipped: [],
        inputZoom: [],
        touchTargets: [],
      };
      const describe = (el: Element) =>
        `<${el.tagName.toLowerCase()}> ${(el.className || "").toString().slice(0, 70)}`;

      // Horizontal overflow is NOT measured here — see scrollsHorizontally().

      const seenTrack = new Set<string>();
      const seenClip = new Set<string>();
      const seenZoom = new Set<string>();
      const seenTap = new Set<string>();

      for (const el of Array.from(document.querySelectorAll("*"))) {
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.display === "none") continue;

        // (b1) Grid tracks too narrow to hold their content.
        if (cs.display === "grid" || cs.display === "inline-grid") {
          const tracks = cs.gridTemplateColumns
            .split(" ")
            .map(parseFloat)
            .filter((n) => !Number.isNaN(n));
          if (tracks.length > 1) {
            const min = Math.min(...tracks);
            if (min < MIN_GRID_TRACK) {
              const key = `${Math.round(min)}|${describe(el)}`;
              if (!seenTrack.has(key)) {
                seenTrack.add(key);
                out.narrowTracks.push(
                  `${Math.round(min)}px track (${tracks.length} cols) — ${describe(el)}`,
                );
              }
            }
          }
        }

        // (b2) Content clipped by an ancestor rather than pushing the page
        // wide. This is the failure mode a scrollWidth check cannot see, and
        // it is how the worst finding in the audit stayed invisible.
        if (el.scrollWidth > el.clientWidth + 8 && el.clientWidth > 0) {
          const selfScrolls = cs.overflowX === "auto" || cs.overflowX === "scroll";
          if (!selfScrolls) {
            let ancestor = el.parentElement;
            let clippedBy: Element | null = null;
            while (ancestor) {
              const acs = getComputedStyle(ancestor);
              // A scrollable ancestor makes the content reachable — fine.
              if (acs.overflowX === "auto" || acs.overflowX === "scroll") break;
              if (acs.overflowX === "hidden" || acs.overflow === "hidden") {
                clippedBy = ancestor;
                break;
              }
              ancestor = ancestor.parentElement;
            }
            if (clippedBy) {
              const key = `${el.clientWidth}|${describe(el)}`;
              if (!seenClip.has(key)) {
                seenClip.add(key);
                out.clipped.push(
                  `needs ${el.scrollWidth}px, got ${el.clientWidth}px — ${describe(el)}`,
                );
              }
            }
          }
        }

        // (c) Focusable text controls under 16px — iOS zooms the page.
        if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) {
          const type = (el.getAttribute("type") || "").toLowerCase();
          const exempt = [
            "hidden",
            "checkbox",
            "radio",
            "submit",
            "button",
            "range",
            "file",
            "color",
          ];
          if (!exempt.includes(type)) {
            const fs = parseFloat(cs.fontSize);
            if (fs < MIN_CONTROL_FONT_SIZE) {
              const key = `${fs}|${describe(el)}`;
              if (!seenZoom.has(key)) {
                seenZoom.add(key);
                out.inputZoom.push(`${fs}px — ${describe(el)}`);
              }
            }
          }
        }

        // (d) Touch targets. Only elements actually in the viewport: an
        // off-screen carousel slide is not something a thumb can miss, and
        // measuring it produces noise nobody can action.
        const interactive =
          el.tagName === "BUTTON" ||
          (el.tagName === "A" && el.hasAttribute("href")) ||
          el.getAttribute("role") === "button" ||
          el.getAttribute("role") === "tab" ||
          (el.tagName === "INPUT" &&
            ["checkbox", "radio"].includes(
              (el.getAttribute("type") || "").toLowerCase(),
            ));
        if (interactive) {
          const r = el.getBoundingClientRect();
          const onScreen =
            r.width > 0 && r.height > 0 && r.top < window.innerHeight && r.bottom > 0;
          // Links inside running prose are exempt: they inherit the line box,
          // and padding them to 44px would wreck the paragraph.
          const inProse = !!el.closest("p, li, .bz-prose");
          if (onScreen && !inProse) {
            if (r.height < MIN_TOUCH_TARGET || r.width < MIN_TOUCH_TARGET) {
              const label = (
                el.getAttribute("aria-label") ||
                el.textContent ||
                ""
              )
                .trim()
                .slice(0, 30);
              const key = `${Math.round(r.width)}x${Math.round(r.height)}|${label}`;
              if (!seenTap.has(key)) {
                seenTap.add(key);
                out.touchTargets.push(
                  `${Math.round(r.width)}x${Math.round(r.height)} "${label}" — ${describe(el)}`,
                );
              }
            }
          }
        }
      }
      return out;
    },
    { MIN_GRID_TRACK, MIN_CONTROL_FONT_SIZE, MIN_TOUCH_TARGET },
  );
}

test.describe("mobile geometry", () => {
  for (const route of ROUTES) {
    test(`${route} holds its layout at ${VIEWPORT_WIDTH}px`, async ({
      page,
    }, testInfo) => {
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });
      // A route that 404s is a routing bug, not a geometry bug — and this spec
      // should not be the thing that reports it.
      test.skip(
        !!response && response.status() >= 400,
        `${route} returned ${response?.status()}`,
      );

      // Let client-mounted chrome (locale toggle, CTA rail, consent banner)
      // settle before measuring — they are fixed elements with real geometry.
      await page.waitForTimeout(1500);

      const v = await collect(page);
      // Ground-truth overflow, measured after collect() so the scroll it
      // performs cannot affect which elements counted as on-screen.
      const scrolledBy = await scrollsHorizontally(page);
      if (scrolledBy > 0) {
        v.overflow.push(
          `document really scrolls ${scrolledBy}px sideways ` +
            `(clientWidth ${VIEWPORT_WIDTH}px)`,
        );
      }
      const known = KNOWN_FAILURES[route];
      const waived = (check: string) =>
        known?.checks.includes(check)
          ? ` [waived: ${known.owner}]`
          : "";

      const enforce = (
        check: keyof typeof GATE,
        violations: string[],
        message: string,
      ) => {
        if (violations.length === 0) return;
        const body = `${message}\n\n${violations.map((x) => `  • ${x}`).join("\n")}`;
        const isWaived = known?.checks.includes(check);
        if (GATE[check] === "blocking" && !isWaived) {
          expect(violations, body).toEqual([]);
        } else {
          // Report-only (or waived): surface it without failing.
          testInfo.annotations.push({
            type: `${check}${waived(check)}`,
            description: `${violations.length} on ${route}`,
          });
        }
      };

      enforce(
        "overflow",
        v.overflow,
        `${route} scrolls horizontally at ${VIEWPORT_WIDTH}px.`,
      );
      enforce(
        "narrowTracks",
        [...v.narrowTracks, ...v.clipped],
        `${route} has grid tracks under ${MIN_GRID_TRACK}px, or content clipped by an ` +
          `ancestor with overflow:hidden. Both are unreadable on a phone, and neither ` +
          `shows up as horizontal overflow.`,
      );
      enforce(
        "inputZoom",
        v.inputZoom,
        `${route} has form controls under ${MIN_CONTROL_FONT_SIZE}px — iOS Safari zooms ` +
          `the viewport when one is focused. Use text-[16px] md:text-[<existing>].`,
      );
      enforce(
        "touchTargets",
        v.touchTargets,
        `${route} has interactive elements under ${MIN_TOUCH_TARGET}x${MIN_TOUCH_TARGET}.`,
      );
    });
  }
});

/**
 * The waiver list has to shrink, never quietly grow.
 *
 * Without this, a route added to KNOWN_FAILURES to get a PR green stays there
 * forever and the gate decays into documentation. Deleting an entry after the
 * fix lands is the whole contract, so it is asserted rather than trusted.
 */
test("known-failure waivers stay bounded", async () => {
  const count = Object.keys(KNOWN_FAILURES).length;
  expect(
    count,
    `KNOWN_FAILURES has ${count} entries. It shipped with 1 (/developments) and ` +
      `Phase 4 earned its way to 0 — the cap came down with it. It is meant to ` +
      `shrink, never grow. If you added one, fix the route instead, or move the ` +
      `check to "report" for everyone rather than waiving it for yourself.`,
  ).toBeLessThanOrEqual(0);
});

/**
 * The gate's own regression test — and the reason this file has one.
 *
 * The original overflow check compared `scrollWidth` to `innerWidth`, which
 * under mobile emulation can never differ (see scrollsHorizontally). It
 * shipped, passed 34/34 on CI, and was measuring nothing. A negative control
 * ran at the time and caught real failures in the OTHER three checks, which
 * made the suite look verified end-to-end when one quarter of it was inert.
 *
 * So the detector is now tested against a page built to overflow, and against
 * one built not to. If someone "simplifies" this back to a width comparison,
 * the first case goes green and this test fails.
 *
 * Uses setContent on a same-origin page rather than a fixture route: the app
 * must not grow a deliberately-broken page just to satisfy its own gate.
 */
test.describe("the overflow detector itself", () => {
  test("fires on a page that really scrolls, and stays quiet on one that does not", async ({
    page,
    baseURL,
  }) => {
    await page.goto(baseURL ?? "/");

    await page.setContent(
      `<body style="margin:0"><div style="width:3000px;height:50px">wide</div></body>`,
    );
    expect(
      await scrollsHorizontally(page),
      "a 3000px-wide child must be reported as horizontal overflow — if this " +
        "reads 0, the detector is inert and every route below it is unguarded",
    ).toBeGreaterThan(0);

    await page.setContent(
      `<body style="margin:0"><div style="width:100%;height:50px">fits</div></body>`,
    );
    expect(
      await scrollsHorizontally(page),
      "a full-width child must NOT be reported as overflow",
    ).toBe(0);
  });
});
