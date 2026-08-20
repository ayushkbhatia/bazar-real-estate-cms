/**
 * The shortlist card: it closes when the page under it changes, it asks the
 * API for the language it is being read in, and it holds no English of its own.
 *
 * All three were live defects.
 *
 * **Closing.** The drawer mounts in the public layout, so a client-side
 * navigation re-renders `children` and leaves this component's `open` state
 * exactly as it was. The Radix overlay stayed on top of the page it had just
 * navigated to — which reads, from the visitor's chair, as "Compare
 * side-by-side does nothing". Every listing link in the list had it too.
 *
 * **Language.** `/api/shortlist` is in `NON_LOCALISED`, so nothing calls
 * `setRequestLocale` for it and `currentLocale()` inside it answers "en" for
 * everyone. The card therefore listed English titles on `/ar` while the compare
 * page one click away listed the Arabic. The locale has to travel in the URL.
 *
 * **Copy.** Six strings were never extracted at all — the pill, the "8 of 25 ·
 * saved to this browser" line, the compare button, the picking help, the area
 * fallback, and four aria-labels. The last test walks the rendered panel for
 * Latin, which is the only assertion that keeps catching them: a new literal
 * added next sprint fails here rather than being noticed by a customer.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";

import { renderWithIntl } from "@/lib/i18n/test-utils";
import { COMPARE_STORAGE_KEY } from "@/lib/compare-store";
import { PreferencesProvider } from "@/lib/preferences";
import type { Locale } from "@/lib/i18n/locales";

const mocks = vi.hoisted(() => ({ path: "/buy" }));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.path }));

import { ShortlistDrawer } from "./shortlist-drawer";

const IDS = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
];

const ITEMS = [
  {
    id: IDS[0],
    reference: "BAZ-AD-01302",
    slug: "muheira",
    title: "تارا بارك",
    price_aed: 3_300_000,
    beds: 3,
    baths: 2,
    area_name: "جزيرة الريم",
    hero_url: null,
    hero_alt: null,
  },
  {
    id: IDS[1],
    reference: "BAZ-AD-04322",
    slug: "muheira-2",
    title: "برج المها",
    price_aed: 2_300_000,
    beds: 2,
    baths: 2,
    area_name: null,
    hero_url: null,
    hero_alt: null,
  },
];

/** The copy the layout resolves from the `shortlist` library section. */
const AR_COPY: Record<string, string> = {
  trigger_label: "القائمة المختصرة",
  title: "قائمتك المختصرة",
  storage_note: "محفوظة في هذا المتصفح",
  empty: "لا يوجد ما يُعرض",
  pick_help: "اختر حتى أربعة عقارات لعرضها جنبًا إلى جنب.",
  whatsapp_label: "أرسلها إلى مستشار عبر واتساب",
  email_label: "أرسلها إليّ بالبريد الإلكتروني",
  clear_label: "مسح القائمة المختصرة",
  area_fallback: "الإمارات العربية المتحدة",
};

let fetched: string[] = [];

/**
 * An in-memory `Storage`, stubbed in rather than relying on the environment's.
 *
 * jsdom does not always supply `window.localStorage` under the Node version
 * this repo builds on — `lib/compare-store.test.ts` fails on a clean checkout
 * for exactly that reason — and a spec that is red before the change it tests
 * teaches nobody anything. The component only ever calls
 * getItem/setItem/clear, so a Map is a faithful stand-in.
 */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  } as Storage;
}

beforeEach(() => {
  fetched = [];
  mocks.path = "/ar/buy";
  const store = memoryStorage();
  store.setItem(COMPARE_STORAGE_KEY, JSON.stringify(IDS));
  // jsdom's `window` IS `globalThis`, so this reaches `window.localStorage`.
  vi.stubGlobal("localStorage", store);
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      fetched.push(String(url));
      return Promise.resolve({ ok: true, json: async () => ({ items: ITEMS }) });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/**
 * The drawer formats prices, so it needs the preferences context the public
 * layout gives it. `usePreferences` throws outside one in development, which
 * would fail every test here with a stack trace about the wrong thing.
 */
function Harness({ copy = AR_COPY }: { copy?: Record<string, string> }) {
  return (
    <PreferencesProvider>
      <ShortlistDrawer copy={copy} />
    </PreferencesProvider>
  );
}

function mount(locale: Locale = "ar", copy = AR_COPY) {
  return renderWithIntl(<Harness copy={copy} />, { locale });
}

async function openPanel(locale: Locale = "ar") {
  const view = mount(locale);
  screen.getByRole("button", { name: /القائمة المختصرة/ }).click();
  await screen.findByRole("dialog");
  return view;
}

describe("shortlist card", () => {
  it("asks the API for the locale it is being read in", async () => {
    await openPanel();
    await waitFor(() => expect(fetched.length).toBeGreaterThan(0));
    expect(
      fetched[0],
      "without this the drawer lists English titles on an Arabic page",
    ).toContain("locale=ar");
  });

  it("asks for English on an English page", async () => {
    mocks.path = "/buy";
    const view = renderWithIntl(<Harness />, { locale: "en" });
    screen.getByRole("button", { name: /Shortlist/ }).click();
    await waitFor(() => expect(fetched.length).toBeGreaterThan(0));
    expect(fetched[0]).toContain("locale=en");
    view.unmount();
  });

  it("closes when the page under it changes", async () => {
    const view = await openPanel();
    expect(screen.getByRole("dialog")).toBeTruthy();

    // What a click on "Compare side-by-side" does: the layout stays mounted
    // and only the pathname moves.
    mocks.path = "/ar/tools/compare";
    view.rerender(<Harness />);

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog"),
        "the panel outlived the navigation and covered the page it opened",
      ).toBeNull(),
    );
  });

  it("stays open while the pathname does not move", async () => {
    const view = await openPanel();
    view.rerender(<Harness />);
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("prints the editable storage note around an ICU count", async () => {
    await openPanel();
    // The count is ICU's, the words are the CMS document's, and the whole
    // line used to be an un-extracted English literal.
    expect(screen.getByText(/2 من 25 · محفوظة في هذا المتصفح/)).toBeTruthy();
  });

  it("falls back to the editable area line when a listing has no area", async () => {
    await openPanel();
    await screen.findByText("الإمارات العربية المتحدة");
  });

  it("renders no Latin prose anywhere in the Arabic panel", async () => {
    await openPanel();
    const panel = await screen.findByRole("dialog");
    await screen.findByText(/تارا بارك/);

    // Prices, references and the AED unit are Latin by brand decision
    // (ADR-0007: Western digits), so they are stripped before the sweep
    // rather than exempted case by case.
    // `textContent`, not `innerText` — jsdom does not implement the latter.
    const prose = panel.textContent ?? "";
    const leftovers = prose
      .replace(/AED|[A-Z]{3}-[A-Z]{2}-\d+/g, "")
      .match(/[A-Za-z]{4,}/g);

    expect(
      leftovers ?? [],
      "these words never made it out of the component and into the catalogue " +
        "or the CMS document",
    ).toEqual([]);
  });
});
