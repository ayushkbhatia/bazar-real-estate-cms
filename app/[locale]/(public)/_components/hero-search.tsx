"use client";

import { useTranslations } from "next-intl";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DualRangeSlider } from "./dual-range-slider";
import {
  areaUnitLabel,
  formatArea,
  formatPrice,
  usePreferences,
} from "@/lib/preferences";
import { buildHeroSearchUrl, type Range } from "@/lib/hero-search-config";
import type {
  SearchBarCopy,
  SearchBarCopyKey,
  SearchBarTab,
} from "@/lib/search-bar";

const EMPTY_RANGE: Range = { min: null, max: null };

/**
 * The two selects in the expanded panel read as placeholders until a visitor
 * picks something: "Any type" / "Any beds" sit in the same muted grey as the
 * field labels above them and as the search input's own placeholder, and only
 * a real choice is drawn in ink. A native <select> has no ::placeholder, so
 * the colour has to hang off the value.
 */
function selectClass(chosen: boolean) {
  return cn(
    "h-10 pointer-coarse:min-h-11 px-3 rounded-md bg-white text-[16px] md:text-[13px] outline-none border border-bz-border focus:border-bz-accent",
    chosen ? "text-bz-ink" : "text-bz-muted",
  );
}

/**
 * The tabbed search bar over the home hero.
 *
 * Its tabs, placeholders, property types and button all arrive resolved from
 * the server (`getSearchBar`), already folded to one locale — so this
 * component never sees an `_ar` key and never decides which language to
 * render. What it still owns is the eight shared labels, which fall back to
 * the message catalogue when the CMS has no override: `copy.type_label` is an
 * editor's word for "Property type", and `tr("filters.propertyType")` is the
 * site's own, already translated.
 */
export function HeroSearch({
  tabs,
  copy,
  defaultMode = "off-plan",
}: {
  tabs: SearchBarTab[];
  copy: SearchBarCopy;
  defaultMode?: string;
}) {
  const tr = useTranslations("search");
  const tc = useTranslations("common");
  const { prefs } = usePreferences();
  const router = useRouter();
  const [mode, setMode] = useState(
    tabs.some((t) => t.key === defaultMode) ? defaultMode : tabs[0].key,
  );
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [beds, setBeds] = useState("");
  const [price, setPrice] = useState<Range>(EMPTY_RANGE);
  const [size, setSize] = useState<Range>(EMPTY_RANGE);
  const [pending, startTransition] = useTransition();

  /**
   * Collapsed-on-phones state. Below `md` the console starts as a single
   * search-bar-shaped button and only unfolds when it is tapped; from `md` up
   * the flag is inert, because everything it gates is decided by a breakpoint
   * first — the console is `md:block` whatever this says, and the trigger and
   * the close control are `md:hidden`. That is the whole of the "mobile only"
   * contract: no viewport is read in JS, so the server render and the desktop
   * render are what they were.
   */
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const queryInput = useRef<HTMLInputElement | null>(null);

  // The panel is hidden by a class, never unmounted, so the query field is
  // already in the DOM — but focusing it from the click handler would focus an
  // element still inside a `display:none` ancestor, which no browser honours.
  // An effect runs after the class has come off, so the keyboard rises onto a
  // field that is on screen. Collapsing does not steal focus back.
  useEffect(() => {
    if (expanded) queryInput.current?.focus();
  }, [expanded]);

  const tab = useMemo(
    () => tabs.find((t) => t.key === mode) ?? tabs[0],
    [mode, tabs],
  );

  /** An editor's override, or the site's own already-translated wording. */
  const label = (key: SearchBarCopyKey, message: string) =>
    copy[key]?.trim() || tr(message);

  // Switching tab resets the range/dropdown state — the price ceiling and
  // type list differ per tab, so carrying values over would be misleading.
  function switchTab(next: string) {
    if (next === mode) return;
    setMode(next);
    setType("");
    setBeds("");
    setPrice(EMPTY_RANGE);
    setSize(EMPTY_RANGE);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const url = buildHeroSearchUrl(tab, { q, type, beds, price, size });
    startTransition(() => router.push(url));
  }

  return (
    <form
      onSubmit={submit}
      className="mt-8 w-full max-w-[880px] lg:max-w-[484px] rounded-xl bg-white/10 backdrop-blur-md border border-white/20 p-1.5"
    >
      {/* The phone's resting state: one search-bar-shaped button in place of
          the whole console. It stood at 441px of an 861px hero — half the
          section, over the video — and this is 48px of it. `md:hidden` is the
          only thing scoping it: from `md` up the browser never draws it and
          the console below is shown by its own `md:block`, so the desktop
          hero is untouched.

          A button, not an input: tapping it must open the console rather than
          start typing into a field whose filters are still folded away. The
          placeholder it borrows is the active tab's, so it reads as the input
          it becomes. */}
      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-expanded={false}
          aria-controls={panelId}
          className="md:hidden flex w-full items-center gap-2.5 h-12 rounded-lg bg-white/95 px-3.5 text-start"
        >
          <Search
            size={16}
            strokeWidth={1.8}
            className="shrink-0 text-bz-muted"
          />
          <span className="min-w-0 flex-1 truncate text-[15px] text-bz-muted">
            {tab.placeholder}
          </span>
          <SlidersHorizontal
            size={15}
            strokeWidth={1.8}
            className="shrink-0 text-bz-ink/45"
          />
        </button>
      ) : null}

      {/* The console proper. Hidden on a phone until the bar above is tapped,
          always shown from `md` up. Class-gated rather than unmounted so the
          tab list, the ranges and the query field keep their state across a
          collapse, and so the effect above has an input to focus. */}
      <div id={panelId} className={expanded ? "" : "hidden md:block"}>
        {/* Phones get a way back out; `md:hidden` keeps it off the desktop
            console, which has no collapsed state to return to. */}
        <div className="md:hidden flex items-center justify-between ps-2 pe-1 pt-1">
          <span
            className="text-[11px] font-medium uppercase text-white/70"
            style={{ letterSpacing: "0.12em" }}
          >
            {label("submit_label", "filters.search")}
          </span>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            aria-label={tc("close")}
            aria-controls={panelId}
            className="grid h-11 w-11 place-items-center rounded-md text-white/75 hover:text-white transition-colors"
          >
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>

        {/* Tabs — the row is intrinsically sized (~330px for the four labels at
            12.5px). `shrink-0` + `whitespace-nowrap` pin each button to its own
            width so the narrower lg card can never squeeze them; the trade-off is
            that a fifth tab or a much longer label would overflow visibly rather
            than shrink silently. Labels are editable at /admin/forms/search-bar
            — which is also where a fifth tab would be added, so the note above
            is a warning to whoever adds one.

            `pointer-coarse:min-h-11` is the WCAG 2.5.5 floor. Measured at 390px
            on a production build these are 50x32 "Buy", 54x32 "Rent", 77x32
            "Off-Plan", 95x32 "Commercial" — every one already clears 44 ACROSS,
            so height was the only failing axis and the only thing changed here.

            `min-h-` rather than `h-`: `h-8` and a coarse-pointer `h-11` set the
            same property at the same specificity (a media query adds none), so
            which one wins depends on Tailwind's utility ordering rather than on
            anything this file controls. `min-height` cannot lose that way — it
            clamps the used height whatever the cascade decides. Same reasoning
            the touch-target floor in globals.css gives for its own `min-height`.

            NOT ALSO WIDENED, deliberately. A mistap here runs switchTab, which
            clears type, beds and both ranges, so a wider button would buy real
            protection. Two things stop it. (1) hero-search.test.tsx pins this
            box: it asserts `px-3.5` and `h-8` are present, that no
            `w-/max-w-/min-w-/basis-/flex-1/grow` utility exists on the button,
            and that the button carries NO `sm:|md:|lg:|xl:|2xl:` class at all —
            the intrinsic-width contract is a tested invariant, not a preference.
            (`pointer-coarse:` is not one of those prefixes and not a width
            utility, which is why the floor below leaves all seven tests in that
            file green — verified, not assumed.)
            (2) The slack is thin: 390 − 32 (hero `px-4`) − 12 (form `p-1.5`) − 8
            (row `px-1`) = 338px of track carrying 276px of buttons plus 12px of
            gaps, so ~50px spare, and that is the ENGLISH row. The Arabic labels
            are a different length and the hero section is `overflow-hidden`, so
            tipping this row over would not scroll the page — it would trip the
            *blocking* `clipped` branch of e2e/mobile-geometry.spec.ts on /ar. Not
            a trade worth making for 4px a side without being able to re-measure
            /ar in this stream. */}
        <div
          className="flex gap-1 px-1 pt-1"
          role="tablist"
          aria-label={tr("filters.searchType")}
        >
          {tabs.map((t) => {
            const active = mode === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => switchTab(t.key)}
                className={
                  active
                    ? "h-8 pointer-coarse:min-h-11 shrink-0 whitespace-nowrap px-3.5 rounded-md text-[12.5px] bg-white text-bz-ink font-medium"
                    : "h-8 pointer-coarse:min-h-11 shrink-0 whitespace-nowrap px-3.5 rounded-md text-[12.5px] text-white/80 hover:text-white transition-colors"
                }
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Fields — light panel so the ink sliders stay legible over video. */}
        <div className="mt-1.5 rounded-lg bg-white/95 p-2.5 md:p-3 flex flex-col gap-2.5">
          {/* Row 1: search */}
          <div className="relative">
            <Search
              size={15}
              strokeWidth={1.8}
              className="absolute start-3 top-1/2 -translate-y-1/2 text-bz-muted pointer-events-none"
            />
            <input
              type="text"
              placeholder={tab.placeholder}
              value={q}
              ref={queryInput}
              onChange={(e) => setQ(e.target.value)}
              /* 16px until `md`: iOS Safari zooms the viewport when it focuses a
                 control under 16px, and this input is the first thing a visitor
                 taps on the home page — the hero jumped out from under the search
                 bar on every iPhone. The `md:` half restores the drawn size. */
              className="w-full h-11 md:h-10 ps-9 pe-3 rounded-md bg-white text-bz-ink text-[16px] md:text-[13.5px] outline-none border border-bz-border focus:border-bz-accent"
            />
          </div>

          {/* Row 2: type + (beds | size)

              Both selects carry `pointer-coarse:min-h-11`. They measured 324x40
              at 390px — 4px short on the height axis, full width across, same
              shape as the tabs above.

              Worth knowing before anyone "verifies" this against CI: fixing them
              does NOT move the gate's number. e2e/mobile-geometry.spec.ts counts
              an element as interactive when it is a BUTTON, an A with href, a
              role="button"/role="tab", or an INPUT of type checkbox/radio. A bare
              <select> matches none of those, so on a straight reading of that
              predicate neither of these was ever among the 25 the check reports,
              and raising them cannot make the number go down. That is a reading
              of the source, not a measurement — I could not run the gate from
              this stream, and I could not reconstruct which 8 routes the 25 came
              from, so treat it as the reason these two are LOW-risk to change
              rather than as a prediction of the new total. They are raised
              because a 40px native select is a real 2.5.5 failure on a phone,
              not because the check would ever say so. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-bz-muted">
                {label("type_label", "filters.propertyType")}
              </span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className={selectClass(Boolean(type))}
              >
                <option value="">
                  {label("any_type_label", "filters.anyType")}
                </option>
                {tab.types.map((type) => (
                  <option
                    key={type.value}
                    value={type.value}
                    className="text-bz-ink"
                  >
                    {type.label}
                  </option>
                ))}
              </select>
            </label>

            {tab.beds ? (
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-bz-muted">
                  {label("beds_label", "filters.bedrooms")}
                </span>
                <select
                  value={beds}
                  onChange={(e) => setBeds(e.target.value)}
                  className={selectClass(Boolean(beds))}
                >
                  <option value="">
                    {label("any_beds_label", "filters.anyBeds")}
                  </option>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n} className="text-bz-ink">
                      {n === 6
                        ? tr("filters.bedroomsMax")
                        : tr("filters.bedroomsOption", { count: n })}
                    </option>
                  ))}
                </select>
              </label>
            ) : tab.size ? (
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-bz-muted">
                  {label("size_label", "filters.size")} ({areaUnitLabel(prefs)})
                </span>
                <div className="px-1 pt-1.5">
                  <DualRangeSlider
                    key={`size-${mode}`}
                    min={0}
                    max={tab.size.max}
                    step={tab.size.step}
                    initial={size}
                    format={(n) => formatArea(n, prefs)}
                    onChange={setSize}
                  />
                </div>
              </div>
            ) : null}
          </div>

          {/* Row 3: price slider */}
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-medium text-bz-muted">
              {label("price_label", "filters.priceRange")}
            </span>
            <div className="px-1 pt-1.5">
              {/*
                Bounds and step stay AED — `buildHeroSearchUrl` writes them
                straight into `price_min`/`price_max`, which the search query
                reads as AED. Only the labels convert, exactly as the size
                slider above keeps ft² steps and labels in m².
              */}
              <DualRangeSlider
                key={`price-${mode}`}
                min={0}
                max={tab.price.max}
                step={tab.price.step}
                initial={price}
                format={(n) => formatPrice(n, prefs)}
                onChange={setPrice}
              />
            </div>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={pending}
            className="h-11 md:h-10 w-full"
          >
            {pending
              ? label("pending_label", "filters.searching")
              : label("submit_label", "filters.search")}
          </Button>
        </div>
      </div>
    </form>
  );
}
