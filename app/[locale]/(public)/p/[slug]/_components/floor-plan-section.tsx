import { getTranslations } from "next-intl/server";
import { LayoutGrid, Maximize2, BedDouble } from "lucide-react";

import type { Locale } from "@/lib/i18n/locales";
import { Eyebrow } from "@/components/brand/eyebrow";
import { AreaText } from "../../../_components/area-text";
import { FloorPlanViewer } from "./floor-plan-viewer";

/**
 * Sprint 4c (backfilled): floor plan section on the property detail page.
 * Renders the uploaded plan with a key-facts row beneath. When no plan is
 * uploaded yet (Sprint 7c Media tab), shows a clear "request from advisor"
 * call-out instead of a generic placeholder.
 */
export async function FloorPlanSection({
  eyebrow,
  heading,
  imageUrl,
  beds,
  baths,
  builtUpFt2,
  reference,
  locale,
}: {
  /** Band wording, from the listing-page copy document. */
  eyebrow: string;
  heading: string;
  imageUrl: string | null;
  beds: number;
  baths: number;
  builtUpFt2: number | null;
  reference: string;
  /*
   * Threaded rather than read ambiently. `getTranslations("property")` alone
   * calls `getLocale()`, which reaches `headers()` unless `setRequestLocale`
   * has already run in the same render — and that de-prerenders the route and
   * everything above it. The page's own docblock spells this out; this
   * component follows it rather than reinventing the reasoning.
   */
  locale: Locale;
}) {
  const t = await getTranslations({ locale, namespace: "property" });
  return (
    <section id="floor-plan" className="scroll-mt-16">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h3
        className="serif text-[24px] mt-2 mb-4 leading-tight"
        style={{ letterSpacing: "-0.012em" }}
      >
        {heading}
      </h3>

      {/* Capped rather than filling the ~936px detail column: at full width a
          16:10 plan stood ~585px tall and a portrait one well over 1,000, the
          largest thing on the page for an image nobody reads at that size.
          The enlarge overlay is where the dimensions get read. */}
      <div className="max-w-[640px]">
        {imageUrl ? (
          <FloorPlanViewer
            src={imageUrl}
            alt={t("floorPlan.alt", { reference })}
            // The frame is at most 640px wide (the wrapper) and narrower when
            // `maxHeight` bites; below md it is the page width less padding.
            sizes="(min-width: 768px) 640px, calc(100vw - 32px)"
            maxHeight={440}
          />
        ) : (
          <div className="relative aspect-[16/10] rounded-lg overflow-hidden border border-dashed border-bz-border bg-bz-surface flex items-center justify-center">
            <div className="text-center max-w-[44ch] px-6">
              <LayoutGrid
                size={32}
                strokeWidth={1.4}
                className="text-bz-muted-2 mx-auto mb-3"
              />
              <p className="text-[13.5px] text-bz-ink-2 leading-relaxed">
                {t("floorPlan.none")}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Key facts strip under the plan */}
      <div className="mt-4 grid grid-cols-3 gap-3 max-w-[480px]">
        <FactPill
          icon={<BedDouble size={13} strokeWidth={1.6} />}
          label={t("stat.bedrooms")}
          value={String(beds)}
        />
        <FactPill
          icon={<LayoutGrid size={13} strokeWidth={1.6} />}
          label={t("stat.bathrooms")}
          value={String(baths)}
        />
        <FactPill
          icon={<Maximize2 size={13} strokeWidth={1.6} />}
          label={t("stat.builtUp")}
          value={<AreaText ft2={builtUpFt2} />}
        />
      </div>
    </section>
  );
}

function FactPill({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded border border-bz-border bg-bz-bg">
      <span className="text-bz-muted">{icon}</span>
      <div>
        <div className="text-[10.5px] uppercase tracking-wider text-bz-muted">
          {label}
        </div>
        <div className="text-[13px] font-medium">{value}</div>
      </div>
    </div>
  );
}
