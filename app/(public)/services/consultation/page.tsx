import * as React from "react";
import type { Metadata } from "next";
import { getMasterPageContent } from "@/lib/queries/master-pages";
import { img, list, str, type SectionValues } from "@/lib/master-pages";
import { SERVICE_FORM_ANCHOR } from "@/lib/master-pages/sections/property-management";
import { CONSULTATION_INTENTS } from "@/lib/master-pages/sections/property-consultation";
import { SectionHead } from "../../_components/marketing/section-head";
import { PropTypeGrid } from "../../_components/marketing/prop-type-grid";
import { ServiceHero } from "../_components/service-hero";
import { ServiceCtaBand } from "../_components/service-cta-band";
import { ServiceValueGrid } from "../_components/service-value-grid";
import {
  ServiceLeadForm,
  type InterestOption,
} from "../_components/service-lead-form";
import { mediaCards, valueCards } from "../_components/service-content";

export const metadata: Metadata = {
  title: "Property Consultation in Abu Dhabi | Bazar",
  description:
    "Better property decisions start with the right guidance. Whether you are looking to buy, sell or invest, get professional property guidance based on your requirements, budget and objectives.",
  alternates: { canonical: "/services/consultation" },
};

export const revalidate = 3600;

const SECTION = "px-4 md:px-12 py-14 md:py-[72px] border-t border-bz-border";

type RawOption = { enabled?: boolean; label?: string; intent?: string };

/**
 * Interest buttons, from the editor's list. An intent the editor typed that
 * isn't one the rest of the system knows is dropped to null rather than stored
 * — the option still works, the lead just arrives untagged.
 */
function interestOptions(values: SectionValues): InterestOption[] {
  return list<RawOption>(values, "options")
    .filter((o) => o.enabled !== false && (o.label ?? "").trim() !== "")
    .map((o) => {
      const intent = (o.intent ?? "").trim().toLowerCase();
      return {
        label: o.label!.trim(),
        intent: (CONSULTATION_INTENTS as readonly string[]).includes(intent)
          ? (intent as InterestOption["intent"])
          : null,
      };
    });
}

export default async function PropertyConsultationPage() {
  const content = await getMasterPageContent("consultation");

  const v = (key: string) => content.section(key)?.values ?? {};
  const heroV = v("hero");
  const formV = v("hero_form");
  const helpV = v("help");
  const coversV = v("covers");
  const whoV = v("who");
  const ctaV = v("final_cta");

  const helpTiles = mediaCards(helpV);
  const coversCards = valueCards(coversV);
  const whoCards = valueCards(whoV);

  const nodes: Record<string, React.ReactNode> = {
    hero: (
      <ServiceHero
        key="hero"
        eyebrow={str(heroV, "eyebrow")}
        title={str(heroV, "title")}
        titleEmphasis={str(heroV, "title_emphasis")}
        lede={str(heroV, "lede")}
        sub={str(heroV, "sub")}
        imageUrl={img(heroV, "image")?.url ?? null}
        imageAlt={img(heroV, "image")?.alt ?? null}
        formAnchor={SERVICE_FORM_ANCHOR}
        form={
          <ServiceLeadForm
            kind="consultation"
            interestOptions={interestOptions(formV)}
            copy={{
              title: str(formV, "form_title"),
              sub: str(formV, "form_sub"),
              interestLabel: str(formV, "interest_label"),
              submitLabel: str(formV, "submit_label"),
              note: str(formV, "note"),
              successTitle: str(formV, "success_title"),
              successBody: str(formV, "success_body"),
            }}
          />
        }
      />
    ),

    help:
      helpTiles.length > 0 ? (
        <section key="help" className={SECTION}>
          <SectionHead
            eyebrow={str(helpV, "eyebrow") ?? undefined}
            title={str(helpV, "heading")}
            sub={str(helpV, "intro") ?? undefined}
          />
          <div className="mt-10 md:mt-12">
            <PropTypeGrid items={helpTiles} cols={3} />
          </div>
        </section>
      ) : null,

    covers:
      coversCards.length > 0 ? (
        <section
          key="covers"
          className="bg-bz-surface border-t border-bz-border"
        >
          <div className="px-4 md:px-12 py-14 md:py-[72px]">
            <SectionHead
              eyebrow={str(coversV, "eyebrow") ?? undefined}
              title={str(coversV, "heading")}
              sub={str(coversV, "intro") ?? undefined}
            />
            <div className="mt-10 md:mt-12">
              <ServiceValueGrid items={coversCards} cols={3} />
            </div>
          </div>
        </section>
      ) : null,

    who:
      whoCards.length > 0 ? (
        <section key="who" className={SECTION}>
          <SectionHead
            eyebrow={str(whoV, "eyebrow") ?? undefined}
            title={str(whoV, "heading")}
            sub={str(whoV, "intro") ?? undefined}
          />
          <div className="mt-10 md:mt-12">
            <ServiceValueGrid items={whoCards} cols={4} />
          </div>
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
