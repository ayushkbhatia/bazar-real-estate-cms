import Link from "next/link";
import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { listAgents } from "@/lib/queries/agents";
import { DESK_INTRO, DESK_LABEL, groupByDesk } from "@/lib/agents/desk";
import { SEED_AGENTS } from "@/lib/seeds/agents";
import { buildWhatsAppLink } from "@/lib/whatsapp";

// T1.5 quick win: WhatsApp deep-link on every advisor card.  The live
// staff schema doesn't yet expose phone/whatsapp; until then we match
// the agent slug against the seed roster for the number.
function whatsappFor(slug: string, name: string): string | null {
  const seed = SEED_AGENTS.find((a) => a.slug === slug);
  if (!seed) return null;
  const number = seed.whatsapp ?? seed.phone ?? null;
  return buildWhatsAppLink(number, `Hi ${name}, found you on bazar.ae`);
}

export const metadata: Metadata = {
  title: "Our team",
  description:
    "Twelve senior advisors across buy, sell, rent, off-plan, and investment desks in Abu Dhabi.",
};

export default async function AgentsIndexPage() {
  const agents = await listAgents();
  // T3-A: group by desk so the team page reads as an org chart rather than
  // a flat grid. Order: Leadership → Buy-side → Off-plan → Lettings.
  const grouped = groupByDesk(agents);

  return (
    <div className="bg-bz-bg">
      <section className="px-12 pt-20 pb-14 max-w-[1200px]">
        <Eyebrow>Our team</Eyebrow>
        <h1
          className="serif text-[80px] mt-3 font-normal leading-[0.98]"
          style={{ letterSpacing: "-0.03em" }}
        >
          Twelve advisors.<br />
          By design.
        </h1>
        <p className="mt-8 text-[17px] text-bz-ink-2 leading-relaxed max-w-[60ch]">
          Bazar caps senior advisor headcount. Each advisor owns the
          relationship end-to-end — no junior handoffs, no fee-shares. When you
          engage Bazar, you engage a person.
        </p>
      </section>

      {grouped.map(([desk, deskAgents]) => (
        <section
          key={desk}
          className="px-12 pb-20 max-w-[1280px] border-t border-bz-border"
        >
          <div className="pt-14 mb-10">
            <Eyebrow>{DESK_LABEL[desk]}</Eyebrow>
            <p className="mt-3 text-[15px] text-bz-ink-2 leading-relaxed max-w-[60ch]">
              {DESK_INTRO[desk]}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 gap-y-12">
            {deskAgents.map((a) => {
              const wa = whatsappFor(a.slug, a.display_name);
              return (
                <div key={a.user_id} className="relative group">
                  <Link
                    href={`/agents/${a.slug}`}
                    className="block"
                  >
                    {a.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.photo_url}
                        alt={a.display_name}
                        className="w-full aspect-[4/5] rounded-md object-cover"
                      />
                    ) : (
                      <PlaceholderImage
                        label={a.slug}
                        className="w-full aspect-[4/5] rounded-md"
                      />
                    )}
                    <div className="mt-4">
                      <div className="text-[16px] text-bz-ink group-hover:text-bz-accent transition-colors">
                        {a.display_name}
                      </div>
                      {a.title ? (
                        <div className="text-[12.5px] text-bz-ink-2 mt-0.5">
                          {a.title}
                        </div>
                      ) : null}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {a.specialties.slice(0, 3).map((s) => (
                          <span
                            key={s}
                            className="inline-flex items-center h-6 px-2 rounded-sm border border-bz-border text-[11px] text-bz-ink-2"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                      {a.languages.length > 0 ? (
                        <div className="mt-3 mono text-[11px] text-bz-ink-2">
                          {a.languages.join(" · ")}
                        </div>
                      ) : null}
                    </div>
                  </Link>
                  {/* T1.5 quick win: per-card WhatsApp deep-link.
                      Lives outside the link wrapper so the icon is its own
                      target — clicking the card still navigates to the
                      profile. */}
                  {wa ? (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Message ${a.display_name} on WhatsApp`}
                      className="absolute top-3 right-3 w-9 h-9 rounded-full bg-bz-ink/85 text-bz-bg backdrop-blur-sm inline-flex items-center justify-center hover:bg-bz-ink shadow-md"
                    >
                      <MessageCircle size={14} strokeWidth={1.8} />
                    </a>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
