import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { listPublishedDevelopments } from "@/lib/queries/developments";
import { developmentUrl } from "@/lib/queries/development-utils";
import { mediaPublicUrl } from "@/lib/media";

/**
 * Sprint 4a: home-page off-plan strip — left intro panel + 2 development
 * cards. Reads from existing `listPublishedDevelopments` query.
 */
export async function OffPlanStrip() {
  const developments = await listPublishedDevelopments();
  const featured = developments.slice(0, 2);

  return (
    <section className="px-4 md:px-12 py-12 md:py-20">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-10 md:gap-12 items-start">
        <div className="md:sticky md:top-8">
          <Eyebrow>Off-plan</Eyebrow>
          <h2
            className="serif text-[28px] md:text-[40px] mt-2 leading-tight max-w-[14ch]"
            style={{ letterSpacing: "-0.022em" }}
          >
            New developments worth queuing for.
          </h2>
          <p className="mt-5 text-[14.5px] text-bz-ink-2 leading-relaxed max-w-[42ch]">
            Off-plan inventory we&apos;d actually put our own money into. Full
            payment plans, real handover dates, advisor notes.
          </p>
          <Link
            href="/developments"
            className="mt-8 inline-flex items-center gap-1.5 text-[13.5px] text-bz-ink hover:text-bz-accent transition-colors"
          >
            All developments
            <ArrowRight size={13} strokeWidth={1.7} />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {featured.length === 0 ? (
            <>
              <DevelopmentPlaceholder label="Saadiyat Lagoons" />
              <DevelopmentPlaceholder label="Yas Acres" />
            </>
          ) : (
            featured.map((d, i) => (
              <Link
                key={d.id}
                href={developmentUrl(d)}
                className="group block"
              >
                <div className="relative aspect-[4/5] rounded-lg overflow-hidden bg-bz-surface-2">
                  {d.hero ? (
                    <Image
                      src={mediaPublicUrl(d.hero.storage_key)}
                      alt={d.hero.alt_text ?? d.name}
                      fill
                      sizes="(min-width: 1280px) 400px, 50vw"
                      className="object-cover"
                    />
                  ) : (
                    <PlaceholderImage
                      label={d.slug ?? `development-${i + 1}`}
                      className="w-full h-full"
                    />
                  )}
                </div>
                <div className="mt-4">
                  <div className="text-[11.5px] uppercase tracking-wider text-bz-accent">
                    {d.status === "on_sale" ? "On sale" : "Pre-launch"}
                  </div>
                  <div
                    className="serif text-[22px] mt-1 leading-tight group-hover:text-bz-accent transition-colors"
                    style={{ letterSpacing: "-0.012em" }}
                  >
                    {d.name}
                  </div>
                  {d.starting_price ? (
                    <div className="mt-1 text-[13px] text-bz-ink-2">
                      From{" "}
                      <span className="mono text-bz-navy">
                        AED {(d.starting_price / 1_000_000).toFixed(1)}M
                      </span>
                    </div>
                  ) : null}
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function DevelopmentPlaceholder({ label }: { label: string }) {
  return (
    <div>
      <div className="relative aspect-[4/5] rounded-lg overflow-hidden bg-bz-surface-2">
        <PlaceholderImage label={label.toLowerCase()} className="w-full h-full" />
      </div>
      <div className="mt-4">
        <div className="text-[11.5px] uppercase tracking-wider text-bz-accent">
          On sale
        </div>
        <div
          className="serif text-[22px] mt-1 leading-tight"
          style={{ letterSpacing: "-0.012em" }}
        >
          {label}
        </div>
        <div className="mt-1 text-[13px] text-bz-muted italic">
          Connect a Supabase project + seed developments to see real entries.
        </div>
      </div>
    </div>
  );
}
