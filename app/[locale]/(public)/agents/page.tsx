import { asLocale, type Locale } from "@/lib/i18n/locales";
import { setRequestLocale } from "next-intl/server";
import Image from "next/image";
import Link from "@/components/i18n/link";
import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { listAgents, type AgentProfile } from "@/lib/queries/agents";
import { getMasterPageContent } from "@/lib/queries/master-pages";
import { masterPageMetadata } from "@/lib/queries/search-appearance";
import { agentTokens } from "@/lib/queries/agent-page";
import { str } from "@/lib/master-pages";
import { fillTokens } from "@/lib/master-pages/agent-page";
import { isolateForLocale } from "@/lib/i18n/bidi";
import { DESK_ORDER, groupByDesk, type Desk } from "@/lib/agents/desk";
import { buildWhatsAppLink } from "@/lib/whatsapp";

// T1.5 quick win: WhatsApp deep-link on every advisor card. The number is
// the advisor's own `staff.whatsapp`; it used to be matched out of the seed
// roster on slug, so a real advisor got a fictional one's number and an
// advisor who wasn't a seed got no button at all.
//
// The message is the CMS's (Pages & blocks → Agents → Advisor cards), with
// `{name}` / `{first_name}` filled per advisor. A name can arrive in the other
// script, so it is isolated under Arabic like every token the profile pages
// fill; under English that is the identity.
function whatsappFor(
  agent: AgentProfile,
  template: string | null,
  locale: Locale,
): string | null {
  const tokens = agentTokens(agent.display_name);
  const message = template
    ? fillTokens(template, {
        name: isolateForLocale(tokens.name, locale),
        first_name: isolateForLocale(tokens.first_name, locale),
      })
    : null;
  return buildWhatsAppLink(agent.whatsapp, message);
}

const isDesk = (key: string): key is Desk =>
  (DESK_ORDER as string[]).includes(key);

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  // Title and description are CMS-owned: Pages & blocks → Agents → Search
  // appearance. Unedited, they fall back to the strings that used to be this
  // route's literal `export const metadata`, now in MASTER_PAGE_SEO_DEFAULTS.
  return masterPageMetadata("agents", asLocale((await params).locale), {
    alternates: { canonical: "/agents" },
  });
}

/*
 * The page reads the CMS now, so it takes the interval every sibling master
 * page carries. Saves still revalidate on demand; this is what heals a build
 * that could not reach the database and baked the shipped copy.
 */
export const revalidate = 300;

export default async function AgentsIndexPage({ params }: { params: Promise<{ locale: Locale }> }) {
  /*
   * Locale from `params`, never ambient. An ambient read falls through to
   * `headers()` and takes the route off prerendering — check:routes caught
   * all five of these at once. Set before anything else awaits, for the
   * reason `partners/page.tsx` gives.
   */
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  // Two sources, one round: the page's own words from
  // /admin/pages/master/agents, the advisors from their team records.
  const [content, agents] = await Promise.all([
    getMasterPageContent("agents", locale),
    listAgents(locale),
  ]);
  const v = (key: string) => content.section(key)?.values ?? {};
  const heroV = v("hero");
  const whatsappTemplate = str(v("cards"), "whatsapp_message");
  // T3-A: group by desk so the team page reads as an org chart rather than
  // a flat grid. Which desk an advisor sits on is derived from their title;
  // the order the desks render in, and whether one renders at all, is the
  // editor's — the switched-on desk sections, in document order. A desk with
  // nobody on it drops out whatever its switch says.
  const byDesk = new Map(groupByDesk(agents));
  const grouped = content.order
    .filter(isDesk)
    .flatMap((desk) => {
      const deskAgents = byDesk.get(desk);
      return deskAgents ? [[desk, deskAgents] as const] : [];
    });

  return (
    <div className="bg-bz-bg">
      <section className="px-4 md:px-12 pt-12 md:pt-20 pb-14 max-w-[1200px]">
        {str(heroV, "eyebrow") ? (
          <Eyebrow>{str(heroV, "eyebrow")}</Eyebrow>
        ) : null}
        <h1
          className="serif text-[40px] md:text-[80px] mt-3 font-normal leading-[0.98]"
          style={{ letterSpacing: "-0.03em" }}
        >
          {str(heroV, "title")}
          {str(heroV, "title_second") ? (
            <>
              <br />
              {str(heroV, "title_second")}
            </>
          ) : null}
        </h1>
        {str(heroV, "sub") ? (
          <p className="mt-8 text-[17px] text-bz-ink-2 leading-relaxed max-w-[60ch]">
            {str(heroV, "sub")}
          </p>
        ) : null}
      </section>

      {grouped.map(([desk, deskAgents]) => (
        <section
          key={desk}
          className="px-4 md:px-12 pb-20 max-w-[1280px] border-t border-bz-border"
        >
          <div className="pt-14 mb-10">
            {str(v(desk), "eyebrow") ? (
              <Eyebrow>{str(v(desk), "eyebrow")}</Eyebrow>
            ) : null}
            {str(v(desk), "body") ? (
              <p className="mt-3 text-[15px] text-bz-ink-2 leading-relaxed max-w-[60ch]">
                {str(v(desk), "body")}
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 gap-y-12">
            {deskAgents.map((a) => {
              const wa = whatsappFor(a, whatsappTemplate, locale);
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
