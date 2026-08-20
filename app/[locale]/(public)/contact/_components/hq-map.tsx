import { Navigation } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { HqMapCanvas } from "./hq-map-canvas";

/**
 * Sprint 5e: full-width HQ map under the contact hero.
 *
 * Renders the shared Bazar pastel basemap (recoloured CARTO Positron via
 * ../../_components/map-style) centred on the Al Bateen HQ — the same look as
 * the home, search and listing maps.
 *
 * The five strings on the band are props with the shipped copy as their
 * defaults, filled from `Pages & blocks → Contact → HQ map`. They were
 * literals until then, which is why this was the last band on `/ar/contact`
 * still reading English: a literal has no Arabic twin to fold.
 */

// Verified office location — Bazar Real Estate, Al Bateen, Abu Dhabi.
const HQ_LAT = 24.468113844266917;
const HQ_LNG = 54.339882834551275;

// "Get directions" → Google Maps directions to the office. The api=1 URL
// scheme opens the native Maps app on mobile (in directions mode) and the web
// app on desktop, so it works wherever it's opened or shared.
const DIRECTIONS_URL = `https://www.google.com/maps/dir/?api=1&destination=${HQ_LAT},${HQ_LNG}`;

export function HqMap({
  eyebrow = "HQ",
  heading = "Al Bateen, Abu Dhabi.",
  directionsLabel = "Get directions",
  pinLabel = "Bazar HQ — Al Bateen",
  note = "By appointment only. We don't walk-in business — every meeting is briefed in advance.",
}: {
  eyebrow?: string;
  heading?: string;
  directionsLabel?: string;
  pinLabel?: string;
  note?: string | null;
}) {
  return (
    <section className="border-t border-bz-border">
      <div className="px-4 md:px-12 py-12">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>{eyebrow}</Eyebrow>
            <h2
              className="serif text-[28px] mt-2 leading-tight"
              style={{ letterSpacing: "-0.012em" }}
            >
              {heading}
            </h2>
          </div>
          <a
            href={DIRECTIONS_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="hq-get-directions"
            className="inline-flex h-11 items-center gap-2 rounded-md bg-bz-ink px-5 text-[13.5px] font-medium text-bz-bg transition-colors hover:bg-bz-ink/90"
          >
            <Navigation size={15} strokeWidth={1.8} />
            {directionsLabel}
          </a>
        </div>
        <HqMapCanvas
          lat={HQ_LAT}
          lng={HQ_LNG}
          label={pinLabel}
          className="w-full aspect-[21/9] rounded-lg overflow-hidden border border-bz-border"
        />
        {note ? (
          <p className="mt-4 text-[12px] text-bz-muted">{note}</p>
        ) : null}
      </div>
    </section>
  );
}
