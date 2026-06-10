import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { Eyebrow } from "@/components/brand/eyebrow";

/**
 * Sprint 5e: full-width HQ map under the contact hero.
 *
 * Renders an iframe-free OpenStreetMap embed centred on Saadiyat Island.
 * Sprint 12 swaps this to a real Mapbox interactive embed.
 */
export function HqMap() {
  // Saadiyat marina area — Bazar HQ.
  const lat = 24.5440;
  const lng = 54.4406;
  const bbox = `${lng - 0.012},${lat - 0.008},${lng + 0.012},${lat + 0.008}`;
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;

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
        <div className="relative rounded-lg overflow-hidden border border-bz-border aspect-[21/9]">
          <iframe
            title="Bazar HQ — Saadiyat Island"
            src={mapUrl}
            className="absolute inset-0 w-full h-full"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <noscript>
            <PlaceholderImage label="HQ · Saadiyat Island" className="w-full h-full" />
          </noscript>
        </div>
        <p className="mt-4 text-[12px] text-bz-muted">
          By appointment only. We don&apos;t walk-in business — every meeting
          is briefed in advance.
        </p>
      </div>
    </section>
  );
}
