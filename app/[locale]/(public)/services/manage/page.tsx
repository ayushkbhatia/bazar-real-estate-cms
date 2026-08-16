import * as React from "react";
import type { Metadata } from "next";
import { getMasterPageContent } from "@/lib/queries/master-pages";
import { getForm } from "@/lib/queries/forms";
import { img, str } from "@/lib/master-pages";
import { SERVICE_FORM_ANCHOR } from "@/lib/master-pages/sections/property-management";
import { SERVICE_PROPERTY_TYPES } from "@/lib/schemas/service-lead";
import { listLeadAreaOptions } from "@/lib/queries/lead-routing";
import { SectionHead } from "../../_components/marketing/section-head";
import { StepFlow } from "../../_components/marketing/step-flow";
import { PropTypeGrid } from "../../_components/marketing/prop-type-grid";
import { ServiceHero } from "../_components/service-hero";
import { ServiceCtaBand } from "../_components/service-cta-band";
import { ServiceValueGrid } from "../_components/service-value-grid";
import { ServiceLeadForm } from "../_components/service-lead-form";
import { mediaCards, stepPairs, valueCards } from "../_components/service-content";
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
  return masterPageMetadata("manage", asLocale((await params).locale),
  {
    alternates: { canonical: "/services/manage" },
  });
}

// The location field's suggestions come from the live area index, so the page
// is static-with-refresh rather than frozen at build time.
export const revalidate = 3600;

const SECTION = "px-4 md:px-12 py-14 md:py-[72px] border-t border-bz-border";

export default async function PropertyManagementPage() {
  const [content, areas, leadForm] = await Promise.all([
    getMasterPageContent("manage"),
    listLeadAreaOptions(),
    getForm("services_manage_lead"),
  ]);

  const v = (key: string) => content.section(key)?.values ?? {};
  const heroV = v("hero");
  const formV = v("hero_form");
  const supportV = v("support");
  const careV = v("care");
  const stepsV = v("how_it_works");
  const ctaV = v("final_cta");

  const supportCards = mediaCards(supportV);
  const careCards = valueCards(careV);
  const steps = stepPairs(stepsV);

  const nodes: Record<string, React.ReactNode> = {
    hero: (
      <ServiceHero
        key="hero"
        eyebrow={str(heroV, "eyebrow")}
        title={str(heroV, "title")}
        titleEmphasis={str(heroV, "title_emphasis")}
        sub={str(heroV, "sub")}
        imageUrl={img(heroV, "image")?.url ?? null}
        imageAlt={img(heroV, "image")?.alt ?? null}
        formAnchor={SERVICE_FORM_ANCHOR}
        form={
          <ServiceLeadForm
            form={leadForm}
            areas={areas.map((a) => a.name)}
            propertyTypes={SERVICE_PROPERTY_TYPES}
            copy={{
              title: str(formV, "form_title"),
              sub: str(formV, "form_sub"),
              submitLabel: str(formV, "submit_label"),
              note: str(formV, "note"),
              successTitle: str(formV, "success_title"),
              successBody: str(formV, "success_body"),
            }}
          />
        }
      />
    ),

    support:
      supportCards.length > 0 ? (
        <section key="support" className={SECTION}>
          <SectionHead
            eyebrow={str(supportV, "eyebrow") ?? undefined}
            title={str(supportV, "heading")}
            sub={str(supportV, "intro") ?? undefined}
          />
          <div className="mt-10 md:mt-12">
            <PropTypeGrid items={supportCards} cols={3} />
          </div>
        </section>
      ) : null,

    care:
      careCards.length > 0 ? (
        <section key="care" className="bg-bz-surface border-t border-bz-border">
          <div className="px-4 md:px-12 py-14 md:py-[72px]">
            <SectionHead
              eyebrow={str(careV, "eyebrow") ?? undefined}
              title={str(careV, "heading")}
              sub={str(careV, "intro") ?? undefined}
            />
            <div className="mt-10 md:mt-12">
              <ServiceValueGrid items={careCards} cols={4} />
            </div>
          </div>
        </section>
      ) : null,

    how_it_works:
      steps.length > 0 ? (
        <section key="how_it_works" className={SECTION}>
          <SectionHead
            eyebrow={str(stepsV, "eyebrow") ?? undefined}
            title={str(stepsV, "heading")}
            sub={str(stepsV, "intro") ?? undefined}
          />
          <StepFlow steps={steps} className="mt-10 md:mt-12 max-w-[1000px]" />
        </section>
      ) : null,

    final_cta: (
      <ServiceCtaBand
        key="final_cta"
        eyebrow={str(ctaV, "eyebrow")}
        heading={str(ctaV, "heading")}
        body={str(ctaV, "body")}
        ctaLabel={str(ctaV, "cta_label")}
        ctaHref={str(ctaV, "cta_href") ?? `#${SERVICE_FORM_ANCHOR}`}
        imageUrl={img(ctaV, "image")?.url ?? null}
        imageAlt={img(ctaV, "image")?.alt ?? null}
      />
    ),
  };

  return (
    <div className="bg-bz-bg">
      {content.order.map((key) => (
        <React.Fragment key={key}>{nodes[key] ?? null}</React.Fragment>
      ))}
    </div>
  );
}
