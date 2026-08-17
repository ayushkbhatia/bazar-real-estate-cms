import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { Button } from "@/components/ui/button";
import { SEED_SERVICES, type SeedService } from "@/lib/seeds/services";
import { SEED_AGENTS } from "@/lib/seeds/agents";
import { FloatingCtaTarget } from "../../_components/floating-cta-context";

/**
 * Shared layout for each /services/[slug] sub-page.
 * Imported manually by each sub-route's page.tsx so the Next.js
 * routing tree stays flat.
 */
export async function ServicePage({ service }: { service: SeedService }) {
  const t = await getTranslations("pages.service");
  const orderedSlugs = SEED_SERVICES.map((s) => s.slug);
  const idx = orderedSlugs.indexOf(service.slug);
  const prev = idx > 0 ? SEED_SERVICES[idx - 1] : null;
  const next =
    idx < SEED_SERVICES.length - 1 ? SEED_SERVICES[idx + 1] : null;

  return (
    <div className="bg-bz-bg">
      {/* Crumb */}
      <div className="px-4 md:px-12 pt-10 max-w-[1200px]">
        <Link
          href="/services"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-bz-teal hover:text-bz-navy transition-colors"
        >
          <ArrowLeft size={13} strokeWidth={1.8} />{t("allServices")}</Link>
      </div>

      {/* Hero */}
      <section className="px-4 md:px-12 pt-8 pb-14 max-w-[1200px]">
        <Eyebrow>Service · {service.name}</Eyebrow>
        <h1
          className="serif text-[36px] md:text-[64px] mt-3 font-normal leading-[1.02] max-w-[18ch]"
          style={{ letterSpacing: "-0.025em" }}
        >
          {service.name}
        </h1>
        <p className="mt-6 text-[17px] text-bz-ink-2 leading-relaxed max-w-[60ch]">
          {service.one_liner}
        </p>
      </section>

      {/* Intro + for-whom */}
      <section className="border-y border-bz-border bg-bz-surface">
        <div className="px-4 md:px-12 py-14 max-w-[1200px] grid grid-cols-1 md:grid-cols-[1fr_360px] gap-16 items-start">
          <div>
            <Eyebrow>{t("overview")}</Eyebrow>
            <p className="mt-4 text-[16px] text-bz-ink leading-relaxed">
              {service.intro}
            </p>
          </div>
          <aside className="rounded-lg border border-bz-border bg-bz-bg p-6">
            <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">{t("whoThisIsFor")}</div>
            <p className="mt-3 text-[14px] text-bz-ink leading-relaxed">
              {service.for_whom}
            </p>
            <div className="mt-6 text-[11.5px] uppercase tracking-wider text-bz-muted">{t("pricing")}</div>
            <p className="mono mt-2 text-[13px] text-bz-ink-2">
              {service.pricing}
            </p>
          </aside>
        </div>
      </section>

      {/* Process steps */}
      <section className="px-4 md:px-12 py-12 md:py-20 max-w-[1200px]">
        <Eyebrow>{t("theProcess")}</Eyebrow>
        <h2
          className="serif text-[30px] md:text-[40px] mt-3 leading-[1.05] max-w-[24ch]"
          style={{ letterSpacing: "-0.018em" }}
        >{t("processSub")}</h2>
        <ol className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
          {service.process_steps.map((step, i) => (
            <li key={step.title}>
              <div className="text-[11.5px] uppercase tracking-wider text-bz-navy">
                Step {String(i + 1).padStart(2, "0")}
              </div>
              <h3
                className="serif text-[22px] mt-2 leading-tight"
                style={{ letterSpacing: "-0.012em" }}
              >
                {step.title}
              </h3>
              <p className="mt-3 text-[14px] text-bz-ink-2 leading-relaxed max-w-[48ch]">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* Related tool + CTA */}
      <section className="px-4 md:px-12 pb-20 max-w-[1200px]">
        <div className="bg-bz-accent text-bz-accent-fg rounded-lg p-6 md:p-10 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 items-center">
          <div>
            <Eyebrow className="text-bz-accent-fg/70">{t("nextStep")}</Eyebrow>
            <h3
              className="serif text-[28px] mt-2 leading-tight"
              style={{ letterSpacing: "-0.012em" }}
            >
              {service.contact_cta}.
            </h3>
            {service.related_tool ? (
              <p className="mt-3 text-[14px] opacity-90">
                {t("orTryOur")}{" "}
                <Link
                  href={service.related_tool.href}
                  className="underline underline-offset-2 hover:opacity-100"
                >
                  {service.related_tool.label}
                </Link>{" "}
                {t("first")}
              </p>
            ) : null}
          </div>
          <Button asChild size="lg" variant="secondary">
            <Link href="/contact">{t("talkToAdvisor")}</Link>
          </Button>
        </div>
      </section>

      {/* Prev / next */}
      <section className="border-t border-bz-border bg-bz-surface">
        <div className="px-4 md:px-12 py-8 max-w-[1200px] flex items-center justify-between gap-8">
          {prev ? (
            <Link
              href={`/services/${prev.slug}`}
              className="group inline-flex items-center gap-2 text-[13px] text-bz-ink-2 hover:text-bz-accent transition-colors"
            >
              <ArrowLeft size={14} strokeWidth={1.7} />
              <span>
                <span className="text-bz-muted text-[11px] uppercase tracking-wider block">{t("previous")}</span>
                {prev.name}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              href={`/services/${next.slug}`}
              className="group inline-flex items-center gap-2 text-[13px] text-bz-ink-2 hover:text-bz-accent transition-colors text-end"
            >
              <span>
                <span className="text-bz-muted text-[11px] uppercase tracking-wider block">
                  Next
                </span>
                {next.name}
              </span>
              <ArrowRight size={14} strokeWidth={1.7} />
            </Link>
          ) : (
            <span />
          )}
        </div>
      </section>

      {/* Publishes an advisor to the floating CTA rail (mounted once in the
          public layout). Default lead = MD (SEED_AGENTS[0]) since service
          enquiries don't belong to a specific desk; the firm-wide intake
          routes them from there. */}
      <FloatingCtaTarget
        advisorName={SEED_AGENTS[0]!.display_name}
        advisorPhone={
          SEED_AGENTS[0]!.whatsapp ?? SEED_AGENTS[0]!.phone ?? null
        }
        advisorEmail={SEED_AGENTS[0]!.email ?? null}
        contextRef={service.name}
        tokens={{
          advisor_title: SEED_AGENTS[0]!.title,
          advisor_brn: SEED_AGENTS[0]!.brn,
        }}
        kind="service"
      />
    </div>
  );
}
