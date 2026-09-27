import type { ResolvedBlock } from "@/lib/page-builder";
import type { LandingData } from "@/lib/page-builder/data";
import * as adapt from "@/lib/page-builder/adapters";
import { FormRenderer } from "../../_components/forms/form-renderer";
import { SectionHead } from "../../_components/marketing/section-head";
import { MHero } from "../../_components/marketing/m-hero";
import { FeaturedListings } from "../../_components/marketing/featured-listings";
import { CategoryTiles } from "../../_components/marketing/category-tiles";
import { PropTypeGrid } from "../../_components/marketing/prop-type-grid";
import { StepFlow } from "../../_components/marketing/step-flow";
import { Faq } from "../../_components/marketing/faq";
import { ChipCloud } from "../../_components/marketing/chip-cloud";
import { LeadBand } from "../../_components/marketing/lead-band";
import { WhyBand } from "../../_components/marketing/why-band";
import { FeatureRows } from "../../_components/marketing/feature-rows";
import { ProseBand } from "../../_components/marketing/prose-band";
import { CtaBand } from "../../_components/marketing/cta-band";
import { ImageBand } from "../../_components/marketing/image-band";
import { ServiceHero } from "../../services/_components/service-hero";
import { OffPlanProjects } from "../../_components/home/off-plan-projects";
import { WhoWeAre } from "../../_components/home/who-we-are";
import { HomeTestimonials } from "../../_components/home/home-testimonials";
import { MortgageCalculatorSection } from "../../_components/home/mortgage-calculator-section";
import { PartnerEcosystemSection } from "../../_components/partner-ecosystem-section";
import { ProjectFactsBand } from "../../_components/marketing/project-facts-band";
import { ServiceValueGrid } from "../../services/_components/service-value-grid";
import { AreaStatsBand } from "../../areas/[slug]/_components/area-bands";
import { PaymentPlanSection } from "../../developments/[slug]/_payment-plan";
import { MasterPlanFigure } from "../../developments/[slug]/_components/master-plan-figure";
import { UnitFloorPlans } from "../../developments/[slug]/_components/unit-floor-plans";
import { RendersGallery } from "../../developments/[slug]/_components/renders-gallery";
import { LeadAdvisorBanner } from "../../developments/[slug]/_components/lead-advisor-banner";
import { MapEmbed } from "../../p/[slug]/_components/map-embed";

/**
 * Block key → component.
 *
 * No data access lives here. Everything a block needs was fetched once by
 * `loadLandingData` before the first component rendered — see
 * lib/page-builder/data.ts for why that split is load-bearing rather than
 * tidy-minded.
 */

/** Every key this file can render. `catalogue.test.ts` checks it matches. */
export const RENDERED_KEYS = [
  "hero_media",
  "hero_form",
  "featured_properties",
  "featured_developments",
  "feature_scroll",
  "tiles",
  "prop_types",
  "steps",
  "faq",
  "rich_text",
  "image_band",
  "form_band",
  "cta_band",
  "chips",
  "about_bazar",
  "why_band",
  "testimonials",
  "project_facts",
  "project_payment_plan",
  "project_master_plan",
  "project_unit_plans",
  "project_location",
  "gallery",
  "value_grid",
  "stats_band",
  "mortgage_calculator",
  "advisor",
  "partners",
] as const;

/**
 * A band with the standard page rhythm around a headed section.
 *
 * Several catalogue components are the *inside* of a section on the master
 * pages — the page supplies the padding. Here that padding has to come from
 * somewhere, and putting it in one wrapper is what keeps every block on the
 * same `px-4 md:px-12` / `py-12 md:py-20` grid without each adapter repeating
 * it.
 */
function Band({
  eyebrow,
  title,
  sub,
  children,
  tone,
}: {
  eyebrow?: string | null;
  title?: string | null;
  sub?: string | null;
  children: React.ReactNode;
  tone?: "bg" | "surface";
}) {
  return (
    <section
      className={
        tone === "surface"
          ? "bg-bz-surface-2 px-4 md:px-12 py-12 md:py-20"
          : "px-4 md:px-12 py-12 md:py-20"
      }
    >
      {title || eyebrow ? (
        <SectionHead
          eyebrow={eyebrow ?? undefined}
          title={title ?? undefined}
          sub={sub ?? undefined}
          className="mb-8 md:mb-11"
        />
      ) : null}
      {children}
    </section>
  );
}

/**
 * A form by key.
 *
 * `FormRenderer` (client) rather than `ManagedForm` (server, async): the form
 * was already resolved in the batch, and `ManagedForm` would open a suspense
 * boundary and re-resolve per instance. A form switched off in the Forms
 * Manager renders nothing rather than a heading over an empty box — the publish
 * gate refuses that combination anyway, but a form can be switched off after
 * the page went live.
 */
function FormSlot({
  formKey,
  data,
}: {
  formKey: string | null;
  data: LandingData;
}) {
  const form = formKey ? data.forms[formKey] : null;
  if (!form || !form.enabled) return null;
  return <FormRenderer form={form} />;
}

export function BlockNode({
  block,
  data,
}: {
  block: ResolvedBlock;
  data: LandingData;
}) {
  const v = block.values;

  switch (block.type) {
    case "hero_media":
      return <MHero {...adapt.heroMediaProps(v)} />;

    case "hero_form": {
      const p = adapt.heroFormProps(v);
      return (
        <ServiceHero
          eyebrow={p.eyebrow}
          title={p.title}
          titleEmphasis={p.titleEmphasis}
          lede={p.lede}
          sub={p.sub}
          imageUrl={p.imageUrl}
          imageAlt={p.imageAlt}
          formAnchor={`form-${block.id}`}
          form={<FormSlot formKey={p.formKey} data={data} />}
        />
      );
    }

    case "featured_properties": {
      const p = adapt.featuredPropertiesProps(v, data);
      // FeaturedListings returns null on an empty list, so an unresolvable set
      // of picks leaves no orphan heading behind.
      if (p.items.length === 0) return null;
      return (
        <Band>
          <FeaturedListings {...p} />
        </Band>
      );
    }

    case "featured_developments":
      return <OffPlanProjects {...adapt.featuredDevelopmentsProps(v, data)} />;

    case "feature_scroll":
      return <FeatureRows {...adapt.featureRowsProps(v)} />;

    case "tiles": {
      const p = adapt.tilesProps(v);
      if (p.items.length === 0) return null;
      return (
        <Band eyebrow={p.eyebrow} title={p.title}>
          <CategoryTiles items={p.items} />
        </Band>
      );
    }

    case "prop_types": {
      const p = adapt.propTypesProps(v);
      if (p.items.length === 0) return null;
      return (
        <Band eyebrow={p.eyebrow} title={p.title}>
          <PropTypeGrid items={p.items} cols={p.cols} aspect={p.aspect} />
        </Band>
      );
    }

    case "steps": {
      const p = adapt.stepsProps(v);
      if (p.steps.length === 0) return null;
      return (
        <Band eyebrow={p.eyebrow} title={p.title}>
          <StepFlow steps={p.steps} />
        </Band>
      );
    }

    case "faq": {
      const p = adapt.faqProps(v);
      if (p.items.length === 0) return null;
      return (
        <Band eyebrow={p.eyebrow} title={p.title}>
          <Faq items={p.items} />
        </Band>
      );
    }

    case "rich_text":
      return <ProseBand {...adapt.richTextProps(v)} />;

    case "image_band":
      return <ImageBand {...adapt.imageBandProps(v)} />;

    case "form_band": {
      const p = adapt.formBandProps(v);
      return (
        <LeadBand
          eyebrow={p.eyebrow}
          title={p.title}
          sub={p.sub}
          image={p.image}
          imageUrl={p.imageUrl}
          imageAlt={p.imageAlt}
          form={<FormSlot formKey={p.formKey} data={data} />}
        />
      );
    }

    case "cta_band":
      return <CtaBand {...adapt.ctaBandProps(v)} />;

    case "chips": {
      const p = adapt.chipsProps(v);
      if (p.chips.length === 0) return null;
      return (
        <Band eyebrow={p.eyebrow} title={p.title} sub={p.sub}>
          <ChipCloud
            chips={p.chips}
            icon={p.icon ? undefined : null}
            cta={p.cta}
            ctaHref={p.ctaHref}
          />
        </Band>
      );
    }

    case "about_bazar":
      return <WhoWeAre {...adapt.aboutBazarProps(v)} />;

    case "why_band":
      return <WhyBand {...adapt.whyBandProps(v)} />;

    case "testimonials": {
      const p = adapt.testimonialsProps(v, data);
      // The shared list can be emptied in the section library. A heading over
      // no cards reads as a broken page, so the whole block goes.
      if (p.items.length === 0) return null;
      return (
        <HomeTestimonials
          eyebrow={p.eyebrow}
          heading={p.heading}
          items={p.items}
        />
      );
    }

    case "partners":
      return <PartnerEcosystemSection {...adapt.partnersProps(v, data)} />;

    // ── project sections ──
    // Each adapter answers null when the section has nothing to draw — no
    // project picked, the project since unpublished, or the record without the
    // one thing the section is about. Dropped whole, like an empty list.

    case "project_facts": {
      const p = adapt.projectFactsProps(v, data);
      return p ? <ProjectFactsBand {...p} /> : null;
    }

    case "project_payment_plan": {
      const p = adapt.projectPaymentPlanProps(v, data);
      if (!p) return null;
      return <PaymentPlanSection id={`payment-plan-${block.id}`} {...p} />;
    }

    case "project_master_plan": {
      const p = adapt.projectMasterPlanProps(v, data);
      if (!p) return null;
      return (
        <Band eyebrow={p.eyebrow} title={p.heading} sub={p.intro}>
          <MasterPlanFigure
            image={p.image}
            placeholderLabel=""
            pins={p.pins}
            className="mt-0"
          />
        </Band>
      );
    }

    case "project_unit_plans": {
      const p = adapt.projectUnitPlansProps(v, data);
      if (!p) return null;
      return (
        <UnitFloorPlans
          {...p}
          // "" rather than null: blank is the editor's choice, and null would
          // bring back the component's own English fallback.
          eyebrow={p.eyebrow ?? ""}
          intro={p.intro ?? ""}
        />
      );
    }

    case "project_location": {
      const p = adapt.projectLocationProps(v, data);
      if (!p) return null;
      return (
        <Band eyebrow={p.eyebrow} title={p.heading} sub={p.intro}>
          <MapEmbed
            lat={p.lat}
            lng={p.lng}
            title={p.title}
            className="w-full aspect-[4/3] md:aspect-[16/9] rounded-lg overflow-hidden border border-bz-border"
          />
        </Band>
      );
    }

    // ── more content ──

    case "gallery": {
      const p = adapt.galleryProps(v);
      if (p.interior.length === 0) return null;
      return (
        // The gallery carries its own side and bottom padding — on a project
        // page it follows another band — so only the top is added here.
        <section className="pt-12 md:pt-20">
          <RendersGallery {...p} eyebrow={p.eyebrow ?? ""} />
        </section>
      );
    }

    case "value_grid": {
      const p = adapt.valueGridProps(v);
      if (p.items.length === 0) return null;
      return (
        <Band eyebrow={p.eyebrow} title={p.title} sub={p.sub}>
          <ServiceValueGrid items={p.items} cols={p.cols} />
        </Band>
      );
    }

    case "stats_band":
      // Renders nothing on its own when there are no figures.
      return <AreaStatsBand {...adapt.statsBandProps(v)} />;

    case "mortgage_calculator":
      return <MortgageCalculatorSection {...adapt.mortgageCalculatorProps(v)} />;

    case "advisor": {
      const p = adapt.advisorProps(v, data);
      // Its own anchor: a page may carry more than one advisor card.
      return p ? <LeadAdvisorBanner id={`advisor-${block.id}`} {...p} /> : null;
    }

    default:
      // A block type this build doesn't know. It is kept in storage — see
      // lib/page-builder/document.ts — and simply not drawn.
      return null;
  }
}

export function LandingRenderer({
  blocks,
  data,
}: {
  blocks: ResolvedBlock[];
  data: LandingData;
}) {
  return (
    // The blowout guard lives here rather than in each block: one section's
    // runaway grid track must not be able to make the whole page scroll
    // sideways on a phone.
    <div className="bg-bz-bg overflow-x-clip [&>*]:min-w-0">
      {blocks
        .filter((b) => b.enabled && b.def !== null)
        .map((block) => (
          // Keyed on the instance id, not the index: reordering must move the
          // subtree, not remap state onto a different block.
          <BlockNode key={block.id} block={block} data={data} />
        ))}
    </div>
  );
}
