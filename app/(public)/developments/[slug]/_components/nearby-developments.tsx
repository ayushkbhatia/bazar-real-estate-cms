import Link from "next/link";
import Image from "next/image";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { mediaPublicUrl } from "@/lib/media";
import { developmentUrl } from "@/lib/queries/developments";
import type { DevelopmentIndexRow } from "@/lib/queries/developments";
import { quarterLabel } from "@/lib/schemas/development";

type Props = {
  areaName: string;
  nearby: DevelopmentIndexRow[];
};

/**
 * "Future developments around this property" — for v1 we list other published
 * developments in the same area. Geographic radius search (using
 * `areas.geo`) is a follow-up once geo data is consistently populated.
 */
export function NearbyDevelopments({ areaName, nearby }: Props) {
  if (!nearby.length) return null;

  return (
    <section className="px-4 md:px-12 py-16 scroll-mt-16 border-t border-bz-border bg-bz-surface-2">
      <Eyebrow>Future developments around · {areaName}</Eyebrow>
      <h2
        className="serif text-[32px] mt-2 leading-tight max-w-[28ch]"
        style={{ letterSpacing: "-0.02em" }}
      >
        Future neighbours
      </h2>
      <p className="mt-3 text-[14.5px] text-bz-ink-2 leading-relaxed max-w-[58ch]">
        Other off-plan and recently-handed-over projects within {areaName}.
        Useful for shaping a return profile that accounts for new supply.
      </p>

      <ul className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        {nearby.map((d) => (
          <li key={d.id}>
            <Link
              href={developmentUrl({ slug: d.slug })}
              className="block group rounded-lg border border-bz-border bg-bz-surface overflow-hidden hover:border-bz-ink transition-colors"
            >
              <div className="relative aspect-[3/2] bg-bz-bg">
                {d.hero ? (
                  <Image
                    src={mediaPublicUrl(d.hero.storage_key)}
                    alt={d.hero.alt_text ?? d.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover"
                  />
                ) : (
                  <PlaceholderImage
                    label={d.slug}
                    className="absolute inset-0 w-full h-full"
                  />
                )}
              </div>
              <div className="p-5">
                <div className="eyebrow">
                  {d.developer?.name ?? "Developer"}
                </div>
                <div
                  className="serif text-[22px] mt-1.5"
                  style={{ letterSpacing: "-0.015em" }}
                >
                  {d.name}
                </div>
                {d.handover_date ? (
                  <div className="mt-1.5 text-[12px] text-bz-muted">
                    Handover {quarterLabel(d.handover_date)}
                  </div>
                ) : null}
                {d.tagline ? (
                  <div className="mt-2 text-[12.5px] text-bz-ink-2 line-clamp-2">
                    {d.tagline}
                  </div>
                ) : null}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
