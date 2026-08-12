import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { mediaPublicUrl } from "@/lib/media";
import { developmentUrl } from "@/lib/queries/developments";
import type { DevelopmentIndexRow } from "@/lib/queries/developments";
import { quarterLabel } from "@/lib/schemas/development";

type Props = {
  developerName: string;
  siblings: DevelopmentIndexRow[];
  /** Sub-page overrides. Blank keeps the built-in copy. */
  eyebrow?: string | null;
  heading?: string | null;
  intro?: string | null;
};

export function DeveloperProjectsStrip({
  developerName,
  siblings,
  eyebrow,
  heading,
  intro,
}: Props) {
  if (!siblings.length) return null;
  return (
    <section className="px-4 md:px-12 py-16 scroll-mt-16 border-t border-bz-border">
      <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
        <div>
          <Eyebrow>{eyebrow ?? `Other projects by ${developerName}`}</Eyebrow>
          <h2
            className="serif text-[32px] mt-2"
            style={{ letterSpacing: "-0.02em" }}
          >
            {heading ?? "More from this developer"}
          </h2>
          {intro ? (
            <p className="mt-3 text-[14.5px] text-bz-ink-2 leading-relaxed max-w-[60ch]">
              {intro}
            </p>
          ) : null}
        </div>
      </div>
      <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {siblings.map((d) => (
          <li key={d.id}>
            <Link
              href={developmentUrl({ slug: d.slug })}
              className="block group rounded-lg border border-bz-border bg-bz-surface overflow-hidden hover:border-bz-ink transition-colors"
            >
              <div className="relative aspect-[4/3] bg-bz-surface-2">
                {d.hero ? (
                  <Image
                    src={mediaPublicUrl(d.hero.storage_key)}
                    alt={d.hero.alt_text ?? d.name}
                    fill
                    sizes="(max-width: 768px) 100vw, 25vw"
                    className="object-cover"
                  />
                ) : (
                  <PlaceholderImage
                    label={d.slug}
                    className="absolute inset-0 w-full h-full"
                  />
                )}
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="eyebrow truncate">
                    {d.area?.name ?? "Abu Dhabi"}
                  </div>
                  <ArrowUpRight
                    size={14}
                    strokeWidth={1.6}
                    className="text-bz-muted shrink-0 group-hover:text-bz-ink transition-colors"
                  />
                </div>
                <div
                  className="serif text-[20px] mt-1 truncate"
                  style={{ letterSpacing: "-0.015em" }}
                >
                  {d.name}
                </div>
                {d.handover_date ? (
                  <div className="mt-1 text-[12px] text-bz-muted">
                    Handover {quarterLabel(d.handover_date)}
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
