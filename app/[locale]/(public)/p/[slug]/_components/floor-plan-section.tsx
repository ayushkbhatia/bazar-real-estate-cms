import { LayoutGrid, Maximize2, BedDouble } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { AreaText } from "../../../_components/area-text";
import { FloorPlanViewer } from "./floor-plan-viewer";

/**
 * Sprint 4c (backfilled): floor plan section on the property detail page.
 * Renders the uploaded plan with a key-facts row beneath. When no plan is
 * uploaded yet (Sprint 7c Media tab), shows a clear "request from advisor"
 * call-out instead of a generic placeholder.
 */
export function FloorPlanSection({
  imageUrl,
  beds,
  baths,
  builtUpFt2,
  reference,
}: {
  imageUrl: string | null;
  beds: number;
  baths: number;
  builtUpFt2: number | null;
  reference: string;
}) {
  return (
    <section id="floor-plan" className="scroll-mt-16">
      <Eyebrow>Floor plan</Eyebrow>
      <h3
        className="serif text-[24px] mt-2 mb-4 leading-tight"
        style={{ letterSpacing: "-0.012em" }}
      >
        Unit layout
      </h3>

      {imageUrl ? (
        <FloorPlanViewer
          src={imageUrl}
          alt={`Floor plan for ${reference}`}
          // The section sits in the detail grid: `px-4 md:px-12` page padding,
          // then `lg:grid-cols-[1fr_360px]` with a `gap-12`. So above lg the
          // slot is 100vw − 96 − 360 − 48. Measured 936px at a 1440 viewport.
          sizes="(min-width: 1024px) calc(100vw - 504px), (min-width: 768px) calc(100vw - 96px), calc(100vw - 32px)"
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
              No floor plan attached yet. Enquire about this property and the
              advisor will email one back — typically within 2 hours.
            </p>
          </div>
        </div>
      )}

      {/* Key facts strip under the plan */}
      <div className="mt-4 grid grid-cols-3 gap-3 max-w-[480px]">
        <FactPill icon={<BedDouble size={13} strokeWidth={1.6} />} label="Bedrooms" value={String(beds)} />
        <FactPill icon={<LayoutGrid size={13} strokeWidth={1.6} />} label="Bathrooms" value={String(baths)} />
        <FactPill
          icon={<Maximize2 size={13} strokeWidth={1.6} />}
          label="Built-up"
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
