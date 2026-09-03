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
    <section className="px-4 md:px-12 py-10 md:py-20 border-t border-bz-border">
      <div className="grid overflow-hidden rounded-2xl border border-bz-border bg-bz-surface md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        {/* Form */}
        <div className="min-w-0 p-5 md:p-14">
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
          <p className="mt-2 max-w-[46ch] text-[14px] text-bz-ink-2 leading-relaxed md:mt-3 md:text-[14.5px]">
            {sub}
          </p>
          <div className="mt-5 md:mt-8">{form}</div>
        </div>

        {/* Artwork FIRST on a phone, second from `md`.

            The grid stacks in source order below `md`, which put the picture
            after the form — so a visitor met a 773px column of inputs before
            seeing what the card was about, and the image only appeared once
            they had scrolled past the thing it was meant to introduce. `order`
            moves it without touching the DOM order, so the desktop split (form
            in the leading track, art in the trailing one) is unchanged and
            nothing about the RTL mirror changes either. */}
        {/* Photo — same clipping + track fix as
            app/[locale]/(public)/_components/home/list-your-property.tsx; the two cards
            are the same design and must not diverge. */}
        <div className="relative isolate order-first min-w-0 aspect-[16/10] overflow-hidden bg-bz-ink md:order-none md:aspect-auto md:h-full">
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
