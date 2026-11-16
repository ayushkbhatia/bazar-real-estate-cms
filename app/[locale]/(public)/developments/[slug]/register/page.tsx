import * as React from "react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import Link from "@/components/i18n/link";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { mediaPublicUrl } from "@/lib/media";
import { img, str } from "@/lib/master-pages";
import { getForms } from "@/lib/queries/forms";
import { getDevelopmentPageContent } from "@/lib/queries/subpages";
import { getAdvisorForBanner } from "@/lib/queries/development-content";
import {
  developmentRegisterUrl,
  developmentUrl,
  getPublishedDevelopmentBySlug,
} from "@/lib/queries/developments";
import { getStatusPills } from "@/lib/queries/card-labels";
import { quarterLabel } from "@/lib/schemas/development";
import { handoverQuarter, quarterArgs } from "@/lib/developments/handover";
import { asLocale, type Locale } from "@/lib/i18n/locales";
import { localeAlternates } from "@/lib/i18n/metadata";
import { FormRenderer } from "../../../_components/forms/form-renderer";
import { FloatingCtaTarget } from "../../../_components/floating-cta-context";
import { PriceText } from "../../../_components/area-text";
import { HERO_SIZES } from "../../../_components/hero-sizes";
import { resolveHeroImage } from "../_hero-image";

/**
 * A project's sign-up page: its hero and the "Register your interest" form,
 * and nothing else.
 *
 * Where a newsletter's call to action lands (client, Nov 2026). The project
 * page asks a reader to scroll through fifteen bands and then find a button
 * that opens the form in a dialog; a reader who clicked "Register for priority
 * access" in an email has already decided, so this page puts the form in front
 * of them on arrival.
 *
 * Nothing is stored for it. It is the project's own record and its page's Hero
 * section (/admin/pages/sub/development/<slug>) read a second way, so every
 * published project has one the moment it is published, and an edit to the
 * project page's hero lands here too. The form is the one the project page's
 * dialog uses (`development_interest`, /admin/forms), so the lead takes the
 * same road into Enquiries and Salesforce — stamped with the project, and with
 * this page as its source path, which is how the desk tells a newsletter
 * sign-up from a project-page one.
 *
 * Not indexed: it repeats the project page's hero for a reader who arrived
 * from a link, and has nothing to offer a search engine the project page
 * doesn't. Nothing links to it from the site, so nothing is lost.
 */

export const revalidate = 300;

/**
 * Rendered on first request and cached, not prerendered: a project's sign-up
 * page is visited when a newsletter goes out, not on every deploy, and CI
 * builds against the production database three times a run — a page per
 * project in each locale would be paid for on every push for nothing.
 * `dynamicParams` stays true, so every published project resolves.
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  return [];
}

type PageProps = { params: Promise<{ slug: string; locale: Locale }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug, locale } = await params;
  const d = await getPublishedDevelopmentBySlug(slug);
  if (!d) return { title: "Development not found" };
  const t = await getTranslations({ locale, namespace: "development.register" });
  const alternates = localeAlternates(developmentRegisterUrl(d), asLocale(locale));
  const title = t("metaTitle", { name: d.name });
  const description = t("metaDescription", { name: d.name });
  const ogImage = d.hero
    ? [{ url: mediaPublicUrl(d.hero.storage_key), alt: d.name }]
    : undefined;
  return {
    title: { absolute: title },
    description,
    alternates,
    openGraph: {
      type: "website",
      title,
      description,
      url: alternates.canonical,
      images: ogImage,
      siteName: "Bazar Real Estate",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImage?.map((i) => i.url),
    },
    robots: { index: false, follow: true },
  };
}

export default async function DevelopmentRegisterPage({ params }: PageProps) {
  const { slug, locale } = await params;
  const development = await getPublishedDevelopmentBySlug(slug);
  if (!development) notFound();

  const [t, tc, tp, statusPill, leadForms, content, leadAdvisor] =
    await Promise.all([
      getTranslations({ locale, namespace: "development.register" }),
      getTranslations({ locale, namespace: "development.card" }),
      getTranslations({ locale, namespace: "pages.development" }),
      getStatusPills(asLocale(locale)),
      getForms(["development_interest"]),
      getDevelopmentPageContent({
        name: development.name,
        slug: development.slug,
      }),
      development.lead_advisor_id
        ? getAdvisorForBanner(development.lead_advisor_id)
        : Promise.resolve(null),
    ]);

  const form = leadForms.development_interest!;
  const handover = handoverQuarter(development.handover_date);

  // The project page's Hero section: its wide crop, headline and intro pill
  // win here exactly as they do there.
  const heroValues = content.section("hero")?.values ?? {};
  const sv = (field: string) => str(heroValues, field);
  const hero = resolveHeroImage({
    banner: img(heroValues, "image"),
    coverUrl: development.hero
      ? mediaPublicUrl(development.hero.storage_key)
      : null,
    coverAlt: development.hero?.alt_text ?? null,
    name: development.name,
  });
  const tokens = { project: development.name };

  type Stat = { value: React.ReactNode; label: string };
  const candidates: (Stat | null)[] = [
    development.starting_price != null
      ? {
          value: <PriceText aed={development.starting_price} />,
          label: tp("startingPrice"),
        }
      : null,
    development.bedrooms_text
      ? { value: development.bedrooms_text, label: tp("bedrooms") }
      : null,
    handover
      ? { value: tc("quarter", quarterArgs(handover)), label: tp("handover") }
      : null,
    development.payment_plan
      ? {
          // "60/40 Payment Plan" → "60/40", as on the project page's hero.
          value: development.payment_plan.name.split(" ")[0],
          label: tp("paymentPlan"),
        }
      : null,
  ];
  const stats = candidates.filter((s): s is Stat => s !== null);

  return (
    <article className="bg-bz-bg">
      <section className="relative isolate overflow-hidden text-white">
        {hero.url ? (
          <Image
            src={hero.url}
            alt={hero.alt}
            fill
            sizes={HERO_SIZES}
            priority
            className="object-cover -z-10"
          />
        ) : (
          <PlaceholderImage
            label={`${development.slug} · render`}
            dark
            className="absolute inset-0 -z-10 w-full h-full"
          />
        )}
        {/* Darker at the bottom, where the name sits on a phone, and toward
            the start, where it sits beside the form on a desktop. */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(0,0,0,.12)_0%,rgba(0,0,0,.66)_100%)] lg:bg-[linear-gradient(90deg,rgba(0,0,0,.62)_0%,rgba(0,0,0,.28)_60%,rgba(0,0,0,.18)_100%)] rtl:lg:bg-[linear-gradient(270deg,rgba(0,0,0,.62)_0%,rgba(0,0,0,.28)_60%,rgba(0,0,0,.18)_100%)]"
        />

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] gap-8 lg:gap-16 items-end lg:items-center px-4 md:px-12 pt-16 pb-6 md:pb-12 lg:py-16 lg:min-h-[calc(100svh-var(--bz-header-h))]">
          {/* On a phone the copy keeps a floor so the photo reads above the card,
              and the card follows straight after — the form is the point of
              the page, so it should be on the first screen or close to it. */}
          <div className="flex flex-col min-w-0 min-h-[300px] md:min-h-[400px] lg:min-h-0 self-stretch lg:self-center justify-end">
            <div className="flex gap-2 flex-wrap">
              {development.tagline ? (
                <span className="inline-flex items-center h-[26px] px-2.5 rounded-full text-[11.5px] font-medium bg-bz-accent text-white">
                  {sv("intro") ?? development.tagline}
                </span>
              ) : null}
              <span className="inline-flex items-center h-[26px] px-2.5 rounded-full text-[11.5px] font-medium bg-black/70 text-white">
                {statusPill("off_plan")}
              </span>
              {handover ? (
                <span className="inline-flex items-center h-[26px] px-2.5 rounded-full text-[11.5px] font-medium bg-white/15 text-white backdrop-blur-sm">
                  {tc("handover", quarterArgs(handover))}
                </span>
              ) : null}
            </div>

            <div className="mt-auto lg:mt-10 pt-10 lg:pt-0">
              <div
                className="eyebrow"
                style={{ color: "rgba(255,255,255,.76)" }}
              >
                {development.developer?.name ?? tc("developerFallback")} ·{" "}
                {development.area?.name ?? tc("areaFallback")}
              </div>
              <h1
                className="serif text-[40px] md:text-[72px] lg:text-[84px] font-normal mt-3"
                style={{ letterSpacing: "-0.03em", lineHeight: 0.98 }}
              >
                {sv("heading") ?? development.name}
              </h1>
              {development.description ? (
                <p
                  className="mt-5 text-[16px] md:text-[17px] max-w-[560px] leading-[1.55] line-clamp-4"
                  style={{ color: "rgba(255,255,255,.86)" }}
                >
                  {development.description}
                </p>
              ) : null}

              {stats.length ? (
                <dl
                  /* Desktop and tablet only, as on the project page's hero: on a
                     phone they pushed the form off the first screen. */
                  className="hidden md:flex md:flex-wrap mt-8 pt-6 gap-x-9 gap-y-4"
                  style={{ borderTop: "1px solid rgba(255,255,255,.22)" }}
                >
                  {stats.map((s) => (
                    <div key={s.label} className="min-w-0 flex flex-col-reverse">
                      <dt
                        className="text-[12px] mt-0.5"
                        style={{ color: "rgba(255,255,255,.66)" }}
                      >
                        {s.label}
                      </dt>
                      <dd
                        className="serif text-[22px] md:text-[26px]"
                        style={{ letterSpacing: "-0.015em" }}
                      >
                        {s.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}

              <Link
                href={developmentUrl(development)}
                className="mt-7 hidden lg:inline-flex items-center gap-1.5 text-[13.5px] text-white/85 hover:text-white underline-offset-4 hover:underline"
              >
                {t("fullProject")}
                <ArrowRight size={14} strokeWidth={1.6} className="rtl:-scale-x-100" />
              </Link>
            </div>
          </div>

          <div
            id="register"
            className="w-full rounded-[14px] bg-bz-bg text-bz-ink p-5 md:p-8 shadow-[0_24px_60px_-20px_rgba(0,0,0,.55)]"
          >
            {form.enabled ? (
              <FormRenderer
                form={form}
                tokens={tokens}
                context={{
                  developmentId: development.id,
                  developmentName: development.name,
                }}
                successStyle="soft"
                toastErrors
              />
            ) : (
              <div className="flex flex-col gap-3">
                <h2
                  className="serif text-[26px] md:text-[30px] leading-[1.1]"
                  style={{ letterSpacing: "-0.02em" }}
                >
                  {t("closedTitle", { name: development.name })}
                </h2>
                <p className="text-[14px] text-bz-ink-2 leading-relaxed">
                  {t("closedBody")}
                </p>
                <Link
                  href="/contact"
                  className="mt-2 inline-flex h-10 items-center justify-center rounded-md bg-bz-ink px-5 text-[14px] font-medium text-bz-bg hover:bg-bz-ink/90"
                >
                  {t("closedCta")}
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* On a phone and tablet the link sits under the card, off the photo. */}
      <div className="lg:hidden px-4 md:px-12 py-6 text-center">
        <Link
          href={developmentUrl(development)}
          className="inline-flex items-center gap-1.5 text-[14px] text-bz-teal underline-offset-4 hover:underline"
        >
          {t("fullProject")}
          <ArrowRight size={14} strokeWidth={1.6} className="rtl:-scale-x-100" />
        </Link>
      </div>

      {/* The floating contact rail routes to this project's advisor, as it
          does on the project page. Renders nothing. */}
      <FloatingCtaTarget
        advisorName={leadAdvisor?.display_name ?? null}
        advisorPhone={leadAdvisor?.whatsapp ?? leadAdvisor?.phone ?? null}
        advisorEmail={leadAdvisor?.email ?? null}
        advisorId={leadAdvisor?.user_id ?? null}
        developmentId={development.id}
        contextRef={development.name}
        tokens={{
          development_name: development.name,
          developer_name: development.developer?.name ?? null,
          handover: quarterLabel(development.handover_date),
          area_name: development.area?.name ?? null,
          advisor_title: leadAdvisor?.title ?? null,
          advisor_brn: leadAdvisor?.brn ?? null,
        }}
        kind="development"
      />
    </article>
  );
}
