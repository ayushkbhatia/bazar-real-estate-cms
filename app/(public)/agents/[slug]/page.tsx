import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Mail, MessageCircle, Phone } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { Button } from "@/components/ui/button";
import { getSeedAgentBySlug, SEED_AGENTS } from "@/lib/seeds/agents";
import { getSeedAreaGuideBySlug } from "@/lib/seeds/areas";

export async function generateStaticParams() {
  return SEED_AGENTS.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const agent = getSeedAgentBySlug(slug);
  if (!agent) return { title: "Advisor not found" };
  return {
    title: `${agent.display_name} — ${agent.title}`,
    description: agent.bio,
  };
}

export default async function AgentProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const agent = getSeedAgentBySlug(slug);
  if (!agent) notFound();

  const areas = agent.areas
    .map((a) => getSeedAreaGuideBySlug(a))
    .filter((a) => a != null);

  const waUrl = `https://wa.me/${agent.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
    `Hi ${agent.display_name.split(" ")[0]}, I'd like to talk about a Bazar engagement.`,
  )}`;

  return (
    <div className="bg-bz-bg">
      {/* Crumb */}
      <div className="px-12 pt-10 max-w-[1280px]">
        <Link
          href="/agents"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-bz-muted hover:text-bz-ink-2 transition-colors"
        >
          <ArrowLeft size={13} strokeWidth={1.8} />
          Our team
        </Link>
      </div>

      {/* Hero */}
      <section className="px-12 pt-8 pb-14 max-w-[1280px]">
        <div className="grid grid-cols-[360px_1fr] gap-16 items-start">
          <PlaceholderImage
            label={agent.slug}
            className="w-full aspect-[4/5] rounded-md"
          />
          <div>
            <Eyebrow>{agent.title}</Eyebrow>
            <h1
              className="serif text-[56px] mt-3 font-normal leading-[1.02] max-w-[16ch]"
              style={{ letterSpacing: "-0.025em" }}
            >
              {agent.display_name}
            </h1>
            <p className="mt-6 text-[16px] text-bz-ink-2 leading-relaxed max-w-[60ch]">
              {agent.bio}
            </p>
            <blockquote
              className="serif italic text-[20px] mt-8 pl-5 border-l-2 border-bz-accent text-bz-ink leading-relaxed max-w-[56ch]"
              style={{ letterSpacing: "-0.005em" }}
            >
              &ldquo;{agent.pull_quote}&rdquo;
            </blockquote>

            {/* Contact actions */}
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild>
                <a href={`tel:${agent.phone.replace(/\s/g, "")}`}>
                  <Phone size={14} strokeWidth={1.7} />
                  Call
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href={waUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle size={14} strokeWidth={1.7} />
                  WhatsApp
                </a>
              </Button>
              <Button asChild variant="ghost">
                <a href={`mailto:${agent.email}`}>
                  <Mail size={14} strokeWidth={1.7} />
                  Email
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-y border-bz-border bg-bz-surface">
        <div className="px-12 py-10 max-w-[1280px]">
          <div className="grid grid-cols-4 gap-10">
            <div>
              <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
                Years in market
              </div>
              <div
                className="serif text-[36px] mt-1 leading-none"
                style={{ letterSpacing: "-0.018em" }}
              >
                {agent.years_in_market}
              </div>
            </div>
            <div>
              <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
                BRN
              </div>
              <div className="mono text-[20px] mt-2 text-bz-ink">
                {agent.brn}
              </div>
            </div>
            <div>
              <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
                Closed lifetime
              </div>
              <div
                className="serif text-[36px] mt-1 leading-none"
                style={{ letterSpacing: "-0.018em" }}
              >
                {agent.closed_aed_lifetime}
              </div>
            </div>
            <div>
              <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
                Closed QTD
              </div>
              <div
                className="serif text-[36px] mt-1 leading-none"
                style={{ letterSpacing: "-0.018em" }}
              >
                {agent.closed_qtd}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Specialties + languages + areas */}
      <section className="px-12 py-16 max-w-[1280px]">
        <div className="grid grid-cols-3 gap-10">
          <div>
            <Eyebrow>Specialties</Eyebrow>
            <ul className="mt-4 flex flex-col gap-2">
              {agent.specialties.map((s) => (
                <li key={s} className="text-[14px] text-bz-ink">
                  · {s}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <Eyebrow>Languages</Eyebrow>
            <ul className="mt-4 flex flex-col gap-2">
              {agent.languages.map((l) => (
                <li key={l} className="text-[14px] text-bz-ink">
                  · {l}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <Eyebrow>Areas</Eyebrow>
            <ul className="mt-4 flex flex-col gap-2">
              {areas.map((a) =>
                a ? (
                  <li key={a.slug}>
                    <Link
                      href={`/areas/${a.slug}`}
                      className="text-[14px] text-bz-ink hover:text-bz-accent transition-colors"
                    >
                      · {a.name}
                    </Link>
                  </li>
                ) : null,
              )}
            </ul>
          </div>
        </div>
      </section>

      {/* Listings placeholder (real wiring in Sprint 9) */}
      <section className="border-t border-bz-border bg-bz-surface">
        <div className="px-12 py-16 max-w-[1280px]">
          <Eyebrow>Active listings</Eyebrow>
          <h2
            className="serif text-[32px] mt-2 leading-tight"
            style={{ letterSpacing: "-0.015em" }}
          >
            What {agent.display_name.split(" ")[0]} is bringing to market.
          </h2>
          <div className="mt-8 py-12 text-center text-[14px] text-bz-muted border border-dashed border-bz-border rounded-md">
            Listings linked to advisors land in Sprint 9.
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-12 py-16 max-w-[1280px]">
        <div className="bg-bz-accent text-bz-accent-fg rounded-lg p-10 grid grid-cols-[1fr_auto] gap-8 items-center">
          <div>
            <Eyebrow className="text-bz-accent-fg/70">Get in touch</Eyebrow>
            <h3
              className="serif text-[28px] mt-2 leading-tight"
              style={{ letterSpacing: "-0.012em" }}
            >
              Work with {agent.display_name.split(" ")[0]}.
            </h3>
          </div>
          <Button asChild size="lg" variant="secondary">
            <Link href="/contact">Send a brief</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
