import { Eyebrow } from "@/components/brand/eyebrow";
import { HqMapCanvas } from "./hq-map-canvas";

/**
 * Sprint 5e: full-width HQ map under the contact hero.
 *
 * Renders the shared Bazar pastel basemap (recoloured CARTO Positron via
 * ../../_components/map-style) centred on the Saadiyat Island HQ — the same
 * look as the home, search and listing maps.
 */
export function HqMap() {
  // Saadiyat marina area — Bazar HQ.
  const lat = 24.5440;
  const lng = 54.4406;

  return (
    <section className="border-t border-bz-border">
      <div className="px-4 md:px-12 py-12">
        <div className="mb-6">
          <Eyebrow>HQ</Eyebrow>
          <h2
            className="serif text-[28px] mt-2 leading-tight"
            style={{ letterSpacing: "-0.012em" }}
          >
            Saadiyat Island, Abu Dhabi.
          </h2>
        </div>
        <HqMapCanvas
          lat={lat}
          lng={lng}
          label="Bazar HQ — Saadiyat Island"
          className="w-full aspect-[21/9] rounded-lg overflow-hidden border border-bz-border"
        />
        <p className="mt-4 text-[12px] text-bz-muted">
          By appointment only. We don&apos;t walk-in business — every meeting
          is briefed in advance.
        </p>
      </div>
    </section>
  );
}
