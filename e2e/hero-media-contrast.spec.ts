import { test, expect } from "@playwright/test";

/**
 * Regression guard for the media hero on /buy and /rent.
 *
 * Picking a hero photo in the master-page editor turns the section into a
 * light-on-dark treatment. That light colour was originally set on the
 * `<section>`, so it also cascaded into the enquiry card sitting beside the
 * copy — a card that keeps its own white surface. The result was a white
 * heading, white field labels and white input text on white: the visitor
 * could not see what they were typing into the page's primary lead form.
 *
 * Axe does not catch this. It reports the card as `incomplete` with
 * "Element has a 1:1 contrast ratio with the background" rather than as a
 * violation, so `e2e/a11y.spec.ts` stays green through it. These assertions
 * are what actually fail if the light colour escapes the copy column again.
 *
 * They hold either way: with no hero image the card is ink-on-white and
 * passes just the same, so the guard does not depend on CMS content.
 */

/** WCAG relative luminance from a computed `rgb()` / `oklab()` colour. */
const CONTRAST = `(a, b) => {
  const parse = (c) => {
    const m = c.match(/-?[\\d.]+/g).map(Number);
    return [m[0], m[1], m[2]];
  };
  const lum = (rgb) => {
    const [r, g, b] = rgb.map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [l1, l2] = [lum(parse(a)), lum(parse(b))].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}`;

for (const path of ["/buy", "/rent"]) {
  test(`${path} hero: the enquiry card's own text stays legible on its surface`, async ({
    page,
  }) => {
    await page.goto(path);

    // The card in the hero grid — scoped to `main` so the floating
    // preferences pill in the layout can't match first.
    const card = page.locator("main .bz-shadow-1").first();
    await expect(card).toBeVisible();

    // Force colours to resolve as rgb() regardless of how the tokens are
    // authored, then compare each piece of card text against the card's own
    // background rather than against whatever the section sets.
    const ratios = await card.evaluate((el, contrastFn) => {
      const contrast = eval(`(${contrastFn})`);
      const toRgb = (node: Element, prop: "color" | "backgroundColor") => {
        const probe = document.createElement("div");
        probe.style.color = getComputedStyle(node)[prop];
        document.body.appendChild(probe);
        const out = getComputedStyle(probe).color;
        probe.remove();
        return out;
      };
      const bg = toRgb(el, "backgroundColor");
      const parts: Record<string, number> = {};
      const add = (label: string, node: Element | null) => {
        if (node) parts[label] = contrast(toRgb(node, "color"), bg);
      };
      add("heading", el.querySelector("div.serif"));
      add("label", el.querySelector("label"));
      add("input", el.querySelector("input"));
      add("textarea", el.querySelector("textarea"));
      return parts;
    }, CONTRAST);

    expect(Object.keys(ratios).length).toBeGreaterThan(0);
    for (const [part, ratio] of Object.entries(ratios)) {
      expect(
        ratio,
        `${path} enquiry card ${part} is ${ratio.toFixed(2)}:1 against the card surface`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
}
