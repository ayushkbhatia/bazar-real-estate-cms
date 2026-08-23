import type { Locale } from "@/lib/i18n/locales";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "@/components/i18n/link";
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

/**
 * Slot width of one portrait in the desk grid.
 *
 * Twelve of these render on this page and every one of them was a raw
 * `<img>` pointing straight at the Supabase original — no srcset, no lazy
 * loading, so a phone showing one portrait at a time downloaded all twelve
 * at full size. The arithmetic below is the grid the section actually lays
 * out: 1 / 2 / 3 columns with a 32px gap, inside a `max-w-[1280px]` section
 * whose gutters are 16px on mobile and 48px from `md` up. Past 1280 the
 * section stops growing, so the column settles at (1280 − 96 − 64) / 3.
 *
 * Declaring `100vw` instead would be off by ~3x on a laptop and hand back
 * most of what next/image is here to save — the mistake
 * components/brand/listing-card.tsx still makes for its 116px thumbnail.
 */
const PORTRAIT_SIZES =
  "(min-width: 1280px) 374px, " +
  "(min-width: 1024px) calc((100vw - 160px) / 3), " +
  "(min-width: 768px) calc((100vw - 128px) / 2), " +
  "(min-width: 640px) calc((100vw - 64px) / 2), " +
  "calc(100vw - 32px)";

export const metadata: Metadata = {
  title: "Our team",
  description:
    "Twelve senior advisors across buy, sell, rent, off-plan, and investment desks in Abu Dhabi.",
};

export default async function AgentsIndexPage({ params }: { params: Promise<{ locale: Locale }> }) {
  /*
   * Locale from `params`, never ambient. An ambient `getTranslations` reads
   * `getLocale()`, which falls through to `headers()` and takes the route off
   * prerendering — check:routes caught all five of these at once.
   */
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "editorial" });
  const agents = await listAgents();
  // T3-A: group by desk so the team page reads as an org chart rather than
  // a flat grid. Order: Leadership → Buy-side → Off-plan → Lettings.
  const grouped = groupByDesk(agents);

  return (
    <div className="bg-bz-bg">
      <section className="px-4 md:px-12 pt-12 md:pt-20 pb-14 max-w-[1200px]">
        <Eyebrow>{t("eyebrow.ourTeam")}</Eyebrow>
        <h1
          className="serif text-[40px] md:text-[80px] mt-3 font-normal leading-[0.98]"
          style={{ letterSpacing: "-0.03em" }}
        >
          Twelve advisors.
          <br />
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
          className="px-4 md:px-12 pb-20 max-w-[1280px] border-t border-bz-border"
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
                  <Link href={`/agents/${a.slug}`} className="block">
                    {a.photo_url ? (
                      <div className="relative w-full aspect-[4/5] rounded-md overflow-hidden">
                        <Image
                          src={a.photo_url}
                          alt={a.display_name}
                          fill
                          sizes={PORTRAIT_SIZES}
                          className="object-cover"
                        />
                      </div>
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
                      profile.

                      That independence is exactly why the size matters. The
                      badge sits on top of a full-card <Link>, so a thumb that
                      misses it does not miss nothing: it opens the advisor's
                      profile instead of the WhatsApp thread. Measured 36x36 at
                      390px, short on BOTH axes, hence min-w as well as min-h.

                      `pointer-coarse:` and not `md:` — the badge is drawn at
                      36px on desktop too, and a mouse hits 36px fine; the
                      question is whether a thumb is doing the tapping, which is
                      also why globals.css scopes its own touch floor this way.
                      `min-w-`/`min-h-` and not `size-11`: `w-9`/`h-9` and a
                      coarse-pointer `size-11` are different Tailwind utilities
                      writing the same two properties at equal specificity, so
                      the winner would be Tailwind's internal ordering of `size`
                      versus `w`/`h` rather than anything written here. The
                      min-* pair cannot lose that way — it clamps the used box
                      whichever declaration applies — and `rounded-full` keeps
                      it a circle at 44 exactly as it was at 36. Position is
                      untouched: the badge is inset 12px into a portrait that is
                      the full column width, so 8 more pixels of box cannot
                      reach the card's edge. */}
                  {wa ? (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Message ${a.display_name} on WhatsApp`}
                      className="absolute top-3 end-3 w-9 h-9 pointer-coarse:min-w-11 pointer-coarse:min-h-11 rounded-full bg-bz-ink/85 text-bz-bg backdrop-blur-sm inline-flex items-center justify-center hover:bg-bz-ink shadow-md"
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
