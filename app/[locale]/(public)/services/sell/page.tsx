import { getTranslations, setRequestLocale } from "next-intl/server";
import * as React from "react";
import { getForm } from "@/lib/queries/forms";
import type { Metadata } from "next";
import Image from "next/image";
import { CalendarDays, Check } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { cn } from "@/lib/utils";
import { listLeadAreaOptions } from "@/lib/queries/lead-routing";
import { getPublicSiteSettings } from "@/lib/queries/site-settings";
import { getMasterPageContent } from "@/lib/queries/master-pages";
import { faqPairs, img, list, statPairs, str } from "@/lib/master-pages";
import { fluid } from "../../_components/marketing/fluid";
import { getSellHeroStats, getTransactionSpark } from "./_data";
import { FaqAccordion } from "./_components/faq-accordion";
import { ListPropertyForm } from "./_components/list-property-form";
import { PricingResources } from "./_components/pricing-resources";
import { masterPageMetadata } from "@/lib/queries/search-appearance";
import { asLocale } from "@/lib/i18n/locales";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  // Title and description are CMS-owned: Pages & blocks → this page →
  // Search appearance. Unedited, they fall back to the strings that used
  // to be the literal here, now in MASTER_PAGE_SEO_DEFAULTS.
  return masterPageMetadata("sell", asLocale((await params).locale),
  {
    alternates: { canonical: "/services/sell" },
  });
}

const DEFAULT_DESK_PHONE = "+971 2 632 2223";

// The hero rail counts live rows and the transactions card reads DLD data, so
// the page is static-with-refresh rather than frozen at build time.
export const revalidate = 3600;

export default async function ListYourPropertyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  // Before any other await. `getMasterPageContent` resolves its locale from
  // the request, and without this `getLocale()` has nothing to resolve — the
  // page renders English content under `lang="ar"` in an RTL layout, which is
  // the failure `lib/i18n/current.ts` describes: it looks finished.
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);

  const [areas, liveStats, spark, settings, content, listForm, t] =
    await Promise.all([
      listLeadAreaOptions(locale),
      getSellHeroStats(),
      getTransactionSpark(),
      getPublicSiteSettings(),
      getMasterPageContent("sell"),
      getForm("services_sell_list_property"),
      getTranslations("pages"),
    ]);

  const v = (key: string) => content.section(key)?.values ?? {};
  const heroV = v("hero");
  const formV = v("form");
  const confirmV = v("confirmation");
  const pricingV = v("pricing");
  const faqV = v("faq");

  const deskPhone = settings.brand.contact_phone?.trim() || DEFAULT_DESK_PHONE;

  const heroLines = (str(heroV, "title") ?? "").split("\n");
  const heroEmphasis = str(heroV, "title_emphasis");
  const heroImage = img(heroV, "image")?.url ?? null;
  const trustPoints = list<{
    enabled?: boolean;
    title?: string;
    detail?: string;
  }>(heroV, "points").filter((p) => p.enabled !== false && p.title);

  // An editor who fills the stat list takes the rail over; left empty it keeps
  // counting live rows, which is what the handoff asks for — no invented
  // numbers, and no number that silently goes stale.
  const editorStats = statPairs(heroV);
  const stats: [string, string][] =
    editorStats.length > 0
      ? editorStats
      : liveStats.map((s) => [s.value, t(`sell.${s.labelKey}`)]);

  const faqItems = faqPairs(faqV);

  // The page is an SEO landing target for "sell my property Abu Dhabi", so the
  // FAQ ships as structured data as well as an accordion.
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map(([question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };

  const nodes: Record<string, React.ReactNode> = {
    /* Hero — pitch left, form right. Stacks form-first on mobile: an owner on
       a phone should land on the first question, not on the pitch. */
    hero: (
      <section
        key="hero"
        className={cn(
          "px-4 md:px-12 pt-10 md:pt-[72px] pb-14 md:pb-20",
          // Only becomes a media hero once a photo is picked. Without one the
          // section keeps its original plain treatment exactly. `bg-bz-navy`
          // is what shows in the moment before the photo decodes, instead of
          // the cream page background flashing behind white type.
          heroImage && "relative overflow-hidden bg-bz-navy",
        )}
      >
        {heroImage ? (
          <>
            {/* Photo and scrim are ordinary positioned siblings, not a
                negative z-index: behind the section they would sit below the
                opaque page wrapper in axe's background stack, which reads
                every white string here as white-on-cream. */}
            <Image
              src={heroImage}
              alt={img(heroV, "image")?.alt ?? ""}
              fill
              sizes="100vw"
              priority
              className="object-cover"
            />
            {/* Two layered gradients: the horizontal pass carries the desktop
                layout, where the copy sits left and the form card right, and
                the vertical pass does the work on mobile once those stack.
                Either alone leaves a corner unreadable. Mirrors the treatment
                on /buy and /rent — see buy-rent-landing.tsx for the contrast
                arithmetic behind these values. */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(90deg, rgba(0,0,0,.52) 0%, rgba(0,0,0,.26) 55%, rgba(0,0,0,.10) 100%), linear-gradient(180deg, rgba(0,0,0,.08) 0%, rgba(0,0,0,.22) 100%)",
              }}
            />
          </>
        ) : null}
        <div
          className={cn(
            "grid grid-cols-1 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] gap-10 lg:gap-[72px] items-start max-w-[1280px]",
            heroImage && "relative",
          )}
        >
          {/* The light copy belongs to this column, not to the section. On the
              section it also cascades into the form card beside it, whose own
              surface stays white — leaving its headings, field labels and the
              owner's typed input white-on-white. */}
          <div
            className={cn(
              "order-2 lg:order-1 lg:pt-2",
              heroImage && "text-white",
            )}
          >
            {str(heroV, "eyebrow") ? (
              <Eyebrow className={heroImage ? "text-white/80" : undefined}>
                {str(heroV, "eyebrow")}
              </Eyebrow>
            ) : null}
            <h1
              className="serif mt-3.5"
              style={{
                fontSize: fluid(64),
                letterSpacing: "-0.03em",
                lineHeight: 1.02,
              }}
            >
              {heroLines.map((line, i) => (
                <React.Fragment key={i}>
                  {i > 0 ? <br /> : null}
                  {line}
                </React.Fragment>
              ))}
              {heroEmphasis ? (
                <>
                  {heroLines.length > 0 ? " " : null}
                  <em className="italic">{heroEmphasis}</em>
                </>
              ) : null}
            </h1>
            {str(heroV, "sub") ? (
              <p
                className={cn(
                  "text-[16px] md:text-[17px] leading-relaxed mt-5 max-w-[480px]",
                  heroImage ? "text-white/85" : "text-bz-ink-2",
                )}
              >
                {str(heroV, "sub")}
              </p>
            ) : null}

            {trustPoints.length > 0 ? (
              <ul className="flex flex-col gap-3.5 mt-8">
                {trustPoints.map((point) => (
                  <li key={point.title} className="flex gap-3 items-start">
                    <span
                      className={cn(
                        "size-[26px] shrink-0 mt-0.5 rounded-full inline-flex items-center justify-center",
                        heroImage
                          ? "bg-white/15 text-white"
                          : "bg-bz-accent-soft text-bz-accent",
                      )}
                    >
                      <Check size={14} strokeWidth={2} />
                    </span>
                    <div>
                      <div className="text-[14px] font-medium">
                        {point.title}
                      </div>
                      {point.detail ? (
                        <div
                          className={cn(
                            "text-[12.5px] mt-0.5 leading-snug",
                            heroImage ? "text-white/80" : "text-bz-muted",
                          )}
                        >
                          {point.detail}
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}

            {stats.length > 0 ? (
              <div
                className={cn(
                  "flex flex-wrap gap-8 md:gap-9 mt-10 pt-6 border-t",
                  heroImage ? "border-white/25" : "border-bz-border",
                )}
              >
                {stats.map(([value, label]) => (
                  <div key={label}>
                    <div
                      className="serif text-[26px] md:text-[30px]"
                      style={{ letterSpacing: "-0.02em" }}
                    >
                      {value}
                    </div>
                    <div
                      className={cn(
                        "text-[11.5px] mt-1 max-w-[130px] leading-snug",
                        heroImage ? "text-white/80" : "text-bz-muted",
                      )}
                    >
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="order-1 lg:order-2">
            {/* Switched off at /admin/forms ⇒ the column collapses rather than
                showing a heading over nothing. */}
            {listForm.enabled ? (
            <ListPropertyForm
              areas={areas}
              deskPhone={deskPhone}
              copy={{
                step1Label: str(formV, "step_1_label"),
                step2Label: str(formV, "step_2_label"),
                continueLabel: str(formV, "continue_label"),
                reassurance: str(formV, "reassurance"),
                detailsTitle: str(formV, "details_title"),
                detailsSub: str(formV, "details_sub"),
                consentLabel: str(formV, "consent_label"),
                submitLabel: str(formV, "submit_label"),
                submitPendingLabel: str(formV, "submit_pending_label"),
                backLabel: str(formV, "back_label"),
                editLabel: str(formV, "edit_label"),
                referenceLabel: str(confirmV, "reference_label"),
                headingMatched: str(confirmV, "heading_matched"),
                headingDesk: str(confirmV, "heading_desk"),
                summaryMatched: str(confirmV, "summary_matched"),
                summaryDesk: str(confirmV, "summary_desk"),
                deskName: str(confirmV, "desk_name"),
                deskRole: str(confirmV, "desk_role"),
                // The image field's `label` carries the monogram the badge
                // falls back to while no logo is picked.
                deskInitials: img(confirmV, "desk_avatar")?.label ?? null,
                deskAvatarUrl: img(confirmV, "desk_avatar")?.url ?? null,
                deskAvatarAlt: img(confirmV, "desk_avatar")?.alt ?? null,
                callLabel: str(confirmV, "call_label"),
                stepsLabel: str(confirmV, "steps_label"),
                steps: list<{
                  enabled?: boolean;
                  when?: string;
                  what?: string;
                }>(confirmV, "steps")
                  .filter((s) => s.enabled !== false && s.when)
                  .map((s) => [s.when ?? "", s.what ?? ""] as [string, string]),
                anotherLabel: str(confirmV, "another_label"),
              }}
            />
            ) : null}
          </div>
        </div>
      </section>
    ),

    pricing: (
      <PricingResources
        key="pricing"
        spark={spark}
        eyebrow={str(pricingV, "eyebrow")}
        heading={str(pricingV, "heading")}
        body={str(pricingV, "body")}
        cards={list(pricingV, "cards")}
        guides={list(pricingV, "guides")}
        rangeTitle={str(pricingV, "range_title")}
        rangeLabels={[
          str(pricingV, "range_low"),
          str(pricingV, "range_mid"),
          str(pricingV, "range_high"),
        ]}
        sparkPlaceholder={str(pricingV, "spark_placeholder")}
        sparkNote={str(pricingV, "spark_note")}
      />
    ),

    faq: (
      <section
        key="faq"
        className="px-4 md:px-12 py-16 md:py-20 md:pb-24"
      >
        <div className="grid grid-cols-1 lg:grid-cols-[0.62fr_1.38fr] gap-10 lg:gap-[72px] items-start max-w-[1280px]">
          <div>
            {str(faqV, "eyebrow") ? (
              <Eyebrow>{str(faqV, "eyebrow")}</Eyebrow>
            ) : null}
            <h2
              className="serif text-[30px] md:text-[40px] mt-2.5 leading-[1.1]"
              style={{ letterSpacing: "-0.025em" }}
            >
              {str(faqV, "heading")}
            </h2>
            <p className="text-[14px] text-bz-ink-2 mt-3.5 leading-relaxed">
              {/* Stored either side of the number rather than as one string
                  with markup in it: the tap-to-call link is built from the
                  brand phone setting, so the number itself can't be typed
                  here without the two drifting apart. */}
              {str(faqV, "phone_intro")}{" "}
              <a
                href={`tel:${deskPhone.replace(/\s+/g, "")}`}
                className="text-bz-ink font-medium underline underline-offset-4 decoration-bz-taupe"
              >
                {deskPhone}
              </a>{" "}
              {str(faqV, "phone_outro")}
            </p>
            {str(faqV, "cta_label") ? (
              <a
                href={str(faqV, "cta_href") ?? "/contact"}
                className="mt-5 h-11 px-4 rounded border border-bz-border inline-flex items-center gap-2 text-[13px] transition-colors hover:bg-bz-surface-2"
              >
                <CalendarDays size={15} strokeWidth={1.7} />
                {str(faqV, "cta_label")}
              </a>
            ) : null}
          </div>

          <FaqAccordion items={faqItems} />
        </div>
      </section>
    ),
  };

  return (
    <div className="bg-bz-bg">
      {content.order.includes("faq") && faqItems.length > 0 ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      ) : null}

      {content.order.map((key) => (
        <React.Fragment key={key}>{nodes[key] ?? null}</React.Fragment>
      ))}
    </div>
  );
}
