"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Clock } from "lucide-react";

const PRESETS = [
  { label: "Cranleigh Abu Dhabi", area: "saadiyat-island" },
  { label: "Yas Mall", area: "yas-island" },
  { label: "Abu Dhabi International Airport", area: "khalifa-city" },
  { label: "Corniche", area: "corniche" },
] as const;

/**
 * Sprint 4 (backfilled): commute-time filter tool. Selecting a preset
 * destination + max minutes will limit search results to listings within
 * that isochrone — once Mapbox's Isochrone API is wired (Sprint 12).
 *
 * For Sprint 4 we surface the UI so the filter bar matches the design,
 * with a clear note that the geo filter activates in Sprint 12.
 */
export function CommuteTimeTool() {
  /*
   * The four preset DESTINATIONS stay English: "Yas Mall" and "Cranleigh Abu
   * Dhabi" are proper nouns, and `lib/i18n/mt/proper-nouns.ts` is the standing
   * ruling that those are not translated. Everything the tool says in its own
   * voice is read from the catalogue.
   */
  const t = useTranslations("search");
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<string>(PRESETS[0].label);
  const [minutes, setMinutes] = useState<number>(20);

  return (
    <div className="relative">
      {/* `pointer-coarse:min-h-11` is the WCAG 2.5.5 floor. This trigger
          measured 129x32 at 390px on a production build, so it is wide enough
          and 12px short — height is the only axis touched, and the label keeps
          the width it earns.

          `pointer-coarse:` rather than `md:`, because the question is whether a
          thumb is doing the tapping, not whether the window is narrow: a
          touchscreen laptop should get the taller control, a 380px-wide desktop
          window should not. Desktop-with-a-mouse renders byte-identically.

          `min-h-` rather than `h-`: `h-8` and a coarse-pointer `h-11` set the
          same property at the same specificity — a media query contributes none
          — so which wins is decided by Tailwind's internal utility ordering
          rather than by anything written here. `min-height` clamps the used
          height whichever way that ordering falls, which is the same argument
          globals.css makes for its own `min-height` touch floor. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 h-8 pointer-coarse:min-h-11 px-3 rounded-md border border-bz-border bg-bz-bg text-bz-ink-2 text-[12.5px] hover:border-bz-border-strong transition-colors"
      >
        <Clock size={13} strokeWidth={1.7} />
        {t("commute.label")}
      </button>
      {open ? (
        <div className="absolute end-0 mt-1.5 w-[280px] rounded-md border border-bz-border bg-bz-bg shadow-md p-4 z-10">
          <label className="text-[11.5px] uppercase tracking-wider text-bz-muted">
            {t("commute.destination")}
          </label>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            /* 16px until `md`: a native select under 16px makes iOS Safari
               zoom the viewport as the picker opens, and this one hangs off an
               `absolute end-0` popover — the zoom carried the popover past the
               right edge, so the destination list opened over nothing. The
               `md:` half keeps the 13px the popover is drawn at.

               `pointer-coarse:min-h-11` for the same reason as the minute
               presets below — 36px drawn, `w-full` so only height was short,
               and invisible to the gate twice over (a <select> is not in its
               `interactive` predicate, and this popover is closed when it
               measures). */
            className="mt-1 w-full h-9 pointer-coarse:min-h-11 px-2 rounded-md border border-bz-border bg-bz-bg text-[16px] md:text-[13px]"
          >
            {PRESETS.map((p) => (
              <option key={p.label} value={p.label}>
                {p.label}
              </option>
            ))}
          </select>

          <label className="mt-3 block text-[11.5px] uppercase tracking-wider text-bz-muted">
            {t("commute.within")}
          </label>
          {/* The minute presets are 28px tall — the smallest targets in this
              component. They are NOT part of the 25 the gate reports and never
              were: e2e/mobile-geometry.spec.ts measures a route at scroll 0
              without interacting with it, so this popover is closed and these
              buttons are `display: none`, which collect() skips outright.
              Raised anyway because they are the same defect as the trigger and
              the popover is the only place this filter can be set on a phone.
              Height only, so the row's width is byte-identical to what already
              fits inside the 280px popover — I have no measurement of these
              four boxes (the gate never opens the popover, so none was taken),
              and widening on a guess is how a 280px panel starts clipping. If
              someone does measure them and a label lands under 44px across,
              `pointer-coarse:min-w-11` is the matching one-liner. */}
          <div className="mt-1 inline-flex rounded-md border border-bz-border bg-bz-bg p-0.5">
            {[10, 20, 30, 45].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMinutes(m)}
                className={
                  minutes === m
                    ? "h-7 pointer-coarse:min-h-11 px-2.5 rounded text-[12px] bg-bz-navy text-bz-bg font-medium"
                    : "h-7 pointer-coarse:min-h-11 px-2.5 rounded text-[12px] text-bz-ink-2 hover:text-bz-ink"
                }
              >
                {t("commute.minutes", { count: m })}
              </button>
            ))}
          </div>

          <p className="mt-3 text-[11.5px] text-bz-muted leading-relaxed">
            {t("commute.note", { target, minutes })}
          </p>
        </div>
      ) : null}
    </div>
  );
}
