import type { Locale } from "@/lib/i18n/locales";
import { getPageFaqCopy } from "@/lib/queries/page-faqs";
import { cn } from "@/lib/utils";
import { Faq } from "./faq";
import { SectionHead } from "./section-head";

/**
 * The FAQ at the foot of a guide, service page or tool, read from its page-FAQ
 * document (`lib/master-pages/page-faqs.ts`, edited at
 * /admin/pages/sub/faq/<key>) and published as `FAQPage` structured data by
 * `Faq`.
 *
 * Renders nothing until the page has questions, so mounting it on a page is
 * safe before its content is written.
 */
export async function PageFaq({
  faqKey,
  locale,
  className,
}: {
  faqKey: string;
  /** Omit only where the caller already reads the locale ambiently. */
  locale?: Locale;
  className?: string;
}) {
  const copy = await getPageFaqCopy(faqKey, locale);
  if (copy.items.length === 0) return null;
  return (
    <section
      id="faq"
      className={cn("px-4 md:px-12 py-14 md:py-20 scroll-mt-16", className)}
    >
      <div className="max-w-[1200px]">
        <SectionHead
          eyebrow={copy.eyebrow ?? undefined}
          title={copy.heading ?? undefined}
          sub={copy.intro ?? undefined}
          size={40}
          className="mb-8"
        />
        <Faq items={copy.items} />
      </div>
    </section>
  );
}
