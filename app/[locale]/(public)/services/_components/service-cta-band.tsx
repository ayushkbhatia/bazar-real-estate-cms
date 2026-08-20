import Image from "next/image";
import Link from "@/components/i18n/link";
import { ArrowRight } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { cn } from "@/lib/utils";
import { fluid } from "../../_components/marketing/fluid";

type Props = {
  eyebrow: string | null;
  heading: string | null;
  body: string | null;
  ctaLabel: string | null;
  ctaHref: string;
  imageUrl: string | null;
  imageAlt: string | null;
};

/**
 * The navy band that closes both service landings.
 *
 * The CTA is an `<a>`, not next/link, when it is a same-page anchor: the
 * default href points back at the hero form, and next/link would treat "#…" as
 * a route push. Everything else — an internal path or a full URL an editor
 * typed — goes through Link so internal navigation stays client-side.
 */
export function ServiceCtaBand({
  eyebrow,
  heading,
  body,
  ctaLabel,
  ctaHref,
  imageUrl,
  imageAlt,
}: Props) {
  const anchor = ctaHref.startsWith("#");
  const buttonClass =
    "inline-flex items-center gap-2 h-11 px-5 mt-7 rounded bg-white text-bz-navy text-[13.5px] font-medium transition-colors hover:bg-white/90";

  return (
    <section className="bg-bz-navy text-white px-4 md:px-12 py-16 md:py-20">
      <div
        className={cn(
          "grid grid-cols-1 gap-10 lg:gap-16 items-center",
          imageUrl && "lg:grid-cols-[1.2fr_1fr]",
        )}
      >
        <div>
          {eyebrow ? (
            <Eyebrow className="text-bz-taupe-light">{eyebrow}</Eyebrow>
          ) : null}
          <h2
            className="serif text-white mt-4 max-w-[20ch]"
            style={{
              fontSize: fluid(44),
              letterSpacing: "-0.025em",
              lineHeight: 1.1,
            }}
          >
            {heading}
          </h2>
          {body ? (
            <p className="text-[15px] md:text-[16px] leading-[1.7] mt-5 max-w-[60ch] text-white/75">
              {body}
            </p>
          ) : null}
          {ctaLabel ? (
            anchor ? (
              <a href={ctaHref} className={buttonClass}>
                {ctaLabel}
                <ArrowRight size={15} strokeWidth={1.8} />
              </a>
            ) : (
              <Link href={ctaHref} className={buttonClass}>
                {ctaLabel}
                <ArrowRight size={15} strokeWidth={1.8} />
              </Link>
            )
          ) : null}
        </div>
        {imageUrl ? (
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl">
            <Image
              src={imageUrl}
              alt={imageAlt ?? ""}
              fill
              sizes="(max-width: 1024px) 100vw, 40vw"
              className="object-cover"
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
