import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { EnquiryForm } from "../enquiry-form";
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
  image,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  sub: string;
  image: string;
}) {
  return (
    <section className="px-4 md:px-12 py-14 md:py-20 border-t border-bz-border">
      <div className="grid overflow-hidden rounded-2xl border border-bz-border bg-bz-surface md:grid-cols-[1.05fr_1fr]">
        {/* Form */}
        <div className="p-6 md:p-14">
          <Eyebrow className="text-bz-accent">{eyebrow}</Eyebrow>
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
          <EnquiryForm source="contact_page" showIntent className="mt-8" />
        </div>

        {/* Photo */}
        <div className="relative min-h-[220px] bg-bz-ink md:min-h-0">
          <PlaceholderImage
            label={image}
            dark
            className="absolute inset-0 h-full w-full"
          />
        </div>
      </div>
    </section>
  );
}
