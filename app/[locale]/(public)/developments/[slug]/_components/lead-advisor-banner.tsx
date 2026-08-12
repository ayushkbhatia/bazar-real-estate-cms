import Link from "next/link";
import { Phone, MessageCircle } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import Image from "next/image";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import type { SeedAgent } from "@/lib/seeds/agents";

/**
 * Sprint 5a: dark banner with the lead advisor on a development detail
 * page. Pull quote + Call/Book-site-visit CTAs.
 */
export function LeadAdvisorBanner({
  agent,
  developmentName,
  eyebrow,
  heading,
  intro,
}: {
  agent: SeedAgent;
  developmentName: string;
  /**
   * Sub-page overrides. The banner itself is built from the advisor's own
   * record — name, title, pull quote — so these sit above the card rather
   * than replacing any of it, and only appear once someone writes them.
   */
  eyebrow?: string | null;
  heading?: string | null;
  intro?: string | null;
}) {
  const waUrl = `https://wa.me/${agent.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(
    `Hi ${agent.display_name.split(" ")[0]}, I'd like to book a site visit at ${developmentName}.`,
  )}`;
  return (
    <section
      id="advisor"
      className="px-4 md:px-12 py-16 scroll-mt-24"
    >
      {heading || intro ? (
        <div className="mb-6">
          {heading ? (
            <h2
              className="serif text-[32px] leading-tight"
              style={{ letterSpacing: "-0.02em" }}
            >
              {heading}
            </h2>
          ) : null}
          {intro ? (
            <p className="mt-3 text-[14.5px] text-bz-ink-2 leading-relaxed max-w-[60ch]">
              {intro}
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="rounded-lg overflow-hidden bg-bz-ink text-white grid grid-cols-1 md:grid-cols-[280px_1fr_auto] gap-10 items-center px-6 md:px-10 py-8 md:py-10">
        {agent.photo_url ? (
          <div className="relative w-[200px] h-[240px] overflow-hidden rounded-md">
            <Image
              src={agent.photo_url}
              alt={agent.display_name}
              fill
              sizes="200px"
              className="object-cover"
            />
          </div>
        ) : (
          <PlaceholderImage
            label={agent.slug}
            dark
            className="w-[200px] h-[240px] rounded-md"
          />
        )}
        <div>
          <Eyebrow className="text-white/60">{eyebrow ?? "Lead advisor"}</Eyebrow>
          <Link
            href={`/agents/${agent.slug}`}
            className="block mt-2 serif text-[32px] leading-tight hover:text-bz-accent-soft transition-colors"
            style={{ letterSpacing: "-0.015em" }}
          >
            {agent.display_name}
          </Link>
          <div className="mt-1 text-[13px] text-white/70">{agent.title}</div>
          <blockquote
            className="serif italic text-[20px] mt-5 pl-5 border-l-2 border-bz-accent text-white/90 max-w-[52ch]"
            style={{ letterSpacing: "-0.005em" }}
          >
            &ldquo;{agent.pull_quote}&rdquo;
          </blockquote>
        </div>
        <div className="flex flex-col gap-2 w-full md:w-[200px]">
          <a
            href={`tel:${agent.phone.replace(/\s/g, "")}`}
            className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-md bg-white text-bz-ink text-[13px] font-medium hover:bg-white/90 transition-colors"
          >
            <Phone size={14} strokeWidth={1.8} />
            Call {agent.display_name.split(" ")[0]}
          </a>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-md border border-white/25 text-white text-[13px] hover:bg-white/10 transition-colors"
          >
            <MessageCircle size={14} strokeWidth={1.7} />
            Book site visit
          </a>
        </div>
      </div>
    </section>
  );
}
