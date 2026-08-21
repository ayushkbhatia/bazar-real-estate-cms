import { test, expect } from "@playwright/test";

/**
 * The QR scan destination is /contact-qr. It was originally /contact-us/qr,
 * and the old path still redirects — a printed QR code cannot be re-issued
 * once it is on a card or an office window, so that redirect is permanent.
 *
 * /contact-us was never a page at all; it just reads like one and gets typed.
 */
test("/contact-qr serves the scan landing", async ({ page }) => {
  const res = await page.goto("/contact-qr");
  expect(res?.status()).toBe(200);
  await expect(page).toHaveURL(/\/contact-qr$/);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
});

test("the card saves to a phone — the button downloads a parseable vCard", async ({
  page,
  request,
}) => {
  await page.goto("/contact-qr");
  const save = page.getByTestId("qr-save-contact");
  await expect(save).toBeVisible();

  // Assert against the response rather than a download event: the point is
  // that a phone gets something Contacts will open, which is the content type
  // and the body, not the browser's save dialog.
  const href = await save.getAttribute("href");
  const res = await request.get(href!);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/vcard");
  expect(res.headers()["content-disposition"]).toContain(".vcf");

  const card = await res.text();
  expect(card).toContain("BEGIN:VCARD");
  expect(card).toContain("END:VCARD");
  // The numbers on the page have to be the numbers in the file.
  const shown = await page.getByTestId("qr-mobile-link").innerText();
  expect(card).toContain(shown.split(":").pop()!.trim());
});

/**
 * The card's EN/AR pill IS the site's language switch, not a second one.
 *
 * It used to hold its own `useState` and swap a bilingual pair per label. That
 * stopped working the day master-page content began folding its `_ar` twins
 * down to the request's locale: the server started handing the card one
 * language, both halves of every pair held the same string, and pressing EN on
 * /ar/contact-qr left the copy in Arabic while flipping the layout to LTR.
 *
 * So the assertion is now about the URL. Following either half must land on
 * that locale's page, with the `?setlang=` consumed and stripped by the proxy,
 * and the card must come back rendered in the language it navigated to.
 */
test("the EN/AR toggle drives the site's language switch", async ({ page }) => {
  await page.goto("/contact-qr");
  // `[2]`, not `[1]`: the toggle group carries its own pinned `dir="ltr"`, so
  // the nearest ancestor with a `dir` is the group. The card is the one above.
  const card = page
    .getByTestId("qr-lang-ar")
    .locator("xpath=ancestor::*[@dir][2]");
  await expect(card).toHaveAttribute("dir", "ltr");

  await page.getByTestId("qr-lang-ar").click();
  await expect(page).toHaveURL(/\/ar\/contact-qr$/);
  await expect(card).toHaveAttribute("dir", "rtl");
  await expect(page.getByTestId("qr-lang-ar")).toHaveAttribute(
    "aria-current",
    "true",
  );
  // The point of the whole change: the card is now RENDERED in the language it
  // navigated to, rather than keeping the server's copy and flipping `dir`
  // around it. Asserted on `lang` rather than on any string, because CI reads
  // the live CMS and an editor owns every word on this card.
  await expect(card).toHaveAttribute("lang", "ar");

  await page.getByTestId("qr-lang-en").click();
  // Anchored on the origin: `/\/contact-qr$/` also matches `/ar/contact-qr`,
  // so it would pass without the switch back ever happening.
  await expect(page).toHaveURL(/^https?:\/\/[^/]+\/contact-qr$/);
  await expect(card).toHaveAttribute("dir", "ltr");
});

test("the toggle's halves do not trade places between locales", async ({
  page,
}) => {
  /*
   * The bug that made the card toggle feel dead while every href was correct.
   *
   * The pill inherited the card's `dir`, so `EN | AR` on /contact-qr rendered
   * `AR | EN` on /ar/contact-qr. You tap the right half to reach Arabic; to
   * come back you tap the half you did not tap, which is now AR — the option
   * already active. That navigates to the page you are on, the proxy
   * redirects to the page you are on, and nothing visibly happens.
   *
   * So this measures geometry, not markup: EN must occupy the same side in
   * both locales. jsdom cannot see this, which is why it is here and not in
   * the unit spec.
   */
  const centreX = async (testId: string) => {
    const box = await page.getByTestId(testId).boundingBox();
    return Math.round(box!.x + box!.width / 2);
  };

  await page.goto("/contact-qr");
  const ltr = { en: await centreX("qr-lang-en"), ar: await centreX("qr-lang-ar") };
  expect(ltr.en).toBeLessThan(ltr.ar);

  await page.goto("/ar/contact-qr");
  const rtl = { en: await centreX("qr-lang-en"), ar: await centreX("qr-lang-ar") };
  expect(rtl.en).toBeLessThan(rtl.ar);

  // Same side, same pixels — the card itself is still flipped around it.
  expect(rtl.en).toBe(ltr.en);
  expect(rtl.ar).toBe(ltr.ar);
  await expect(
    page.getByTestId("qr-lang-en").locator("xpath=ancestor::*[@dir][2]"),
  ).toHaveAttribute("dir", "rtl");
});

test("both language toggles on the QR page agree", async ({ page }) => {
  // The header pill and the in-card pill are two presentations of one choice.
  // Two controls that could disagree is the confusion this change removed, so
  // this reads every Arabic option on the page and asserts they are one link
  // repeated — no assumption about which is which, or about their DOM order.
  await page.goto("/contact-qr");

  const arabic = page.getByRole("link", { name: "العربية" });
  await expect(arabic).toHaveCount(2);
  const hrefs = await arabic.evaluateAll((links) =>
    links.map((l) => l.getAttribute("href")),
  );
  expect(new Set(hrefs).size).toBe(1);
});

test("the old /contact-us/qr still reaches it — printed codes keep working", async ({
  page,
}) => {
  await page.goto("/contact-us/qr");
  await expect(page).toHaveURL(/\/contact-qr$/);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
});

test("/contact-us redirects to /contact", async ({ page }) => {
  await page.goto("/contact-us");
  await expect(page).toHaveURL(/\/contact$/);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
});

test("/qr renders a code pointing at the new slug", async ({ page }) => {
  const res = await page.goto("/qr");
  expect(res?.status()).toBe(200);
  await expect(page.locator("svg[shape-rendering='crispEdges']")).toBeVisible();
  // The destination is shown as text under the code, so a scanner-less
  // visitor can type it — and so this test can read it.
  await expect(page.getByText("/contact-qr")).toBeVisible();
});
