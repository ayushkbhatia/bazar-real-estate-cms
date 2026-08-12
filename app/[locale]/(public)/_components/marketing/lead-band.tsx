import Image from "next/image";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { fluid } from "./fluid";

/**
 * Full-width lead-capture band — a second enquiry surface further down the
 * page (the hero holds the first). Copy + image on one side, the shared
 * `EnquiryForm` on the other. Used above the "Why Bazar" band on /buy.
 */
export function LeadBand({
  eyebrow = "Get in touch",
  title,
  sub,
  form,
  image,
  imageUrl,
  imageAlt,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  sub: string;
  /** The lead form itself — a `<ManagedForm>` supplied by the page. */
  form: React.ReactNode;
  /** Caption for the placeholder art, used when no asset is picked. */
  image: string;
  /** Resolved URL of the asset chosen in the master-page editor. */
  imageUrl?: string | null;
  imageAlt?: string | null;
}) {
  return (
    <section className="px-4 md:px-12 py-14 md:py-20 border-t border-bz-border">
      <div className="grid overflow-hidden rounded-2xl border border-bz-border bg-bz-surface md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        {/* Form */}
        <div className="min-w-0 p-6 md:p-14">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2
            className="serif mt-2 font-normal"
            style={{
              fontSize: fluid(40),
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
            }}
          >
            {title}
          </h2>
          <p className="mt-3 max-w-[46ch] text-[14.5px] text-bz-ink-2 leading-relaxed">
            {sub}
          </p>
          <div className="mt-8">{form}</div>
        </div>

        {/* Photo — same clipping + track fix as
            app/[locale]/(public)/_components/home/list-your-property.tsx; the two cards
            are the same design and must not diverge. */}
        <div className="relative isolate min-w-0 aspect-[16/10] overflow-hidden bg-bz-ink md:aspect-auto md:h-full">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={imageAlt ?? ""}
              fill
              sizes="(max-width: 767px) 100vw, 48vw"
              className="absolute inset-0 h-full w-full object-cover"
            />
          ) : (
            <PlaceholderImage
              label={image}
              dark
              className="absolute inset-0 h-full w-full"
            />
          )}
        </div>
      </div>
    </section>
  );
}
