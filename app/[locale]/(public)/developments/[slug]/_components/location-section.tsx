import { Eyebrow } from "@/components/brand/eyebrow";
import { MapEmbed } from "@/app/[locale]/(public)/p/[slug]/_components/map-embed";
import { PlaceholderImage } from "@/components/brand/placeholder-image";

type DevForLocation = {
  name: string;
  slug: string;
  geo?: { lat: number; lng: number } | null;
};

/**
 * Sprint 5a (backfilled): Location anchor section on the development
 * detail page. Renders a real maplibre embed when geo is set, with key
 * commute pills underneath.
 *
 * Sprint 12 swaps to Mapbox + drives commute times from Mapbox Directions.
 */
export function LocationSection({
  development,
}: {
  development: DevForLocation;
}) {
  return (
    <section
      id="location"
      className="px-4 md:px-12 pb-16 scroll-mt-16"
    >
      <Eyebrow>Location</Eyebrow>
      <h2
        className="serif text-[32px] mt-2 leading-tight"
        style={{ letterSpacing: "-0.018em" }}
      >
        Where {development.name} sits.
      </h2>
      <p className="mt-3 text-[14.5px] text-bz-ink-2 leading-relaxed max-w-[60ch]">
        Master-plan position + commute times to key Abu Dhabi destinations.
      </p>

      <div className="mt-6">
        {development.geo &&
        typeof development.geo.lat === "number" &&
        typeof development.geo.lng === "number" ? (
          <MapEmbed
            lat={development.geo.lat}
            lng={development.geo.lng}
            title={development.name}
            className="w-full aspect-[21/9] rounded-lg overflow-hidden border border-bz-border"
          />
        ) : (
          <PlaceholderImage
            label={`${development.slug} · map`}
            className="w-full aspect-[21/9] rounded-lg"
          />
        )}
      </div>

      {/* Commute pills — static for Sprint 5a, real values via Mapbox
          Directions API in Sprint 12. */}
      <div className="mt-5 flex flex-wrap gap-2">
        {COMMUTES.map((c) => (
          <span
            key={c.label}
            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full border border-bz-border bg-bz-bg text-[12px] text-bz-ink-2"
          >
            <span className="mono text-bz-muted">{c.minutes}m</span>
            <span>·</span>
            <span>{c.label}</span>
          </span>
        ))}
      </div>
    </section>
  );
}

const COMMUTES = [
  { label: "Corniche", minutes: 18 },
  { label: "Yas Mall", minutes: 12 },
  { label: "AUH airport", minutes: 22 },
  { label: "Saadiyat Beach Club", minutes: 7 },
  { label: "Cranleigh Abu Dhabi", minutes: 4 },
];
