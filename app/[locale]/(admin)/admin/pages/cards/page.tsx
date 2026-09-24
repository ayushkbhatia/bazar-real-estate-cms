import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { CARDS, cardAdminPath } from "@/lib/master-pages/cards";
import { getCardContent, listCardProjects } from "@/lib/queries/cards";

export const dynamic = "force-dynamic";

/**
 * Index of cards — the card-shaped blocks that repeat across many pages.
 * See `lib/master-pages/cards.ts` for what a card is and is not.
 */
export default async function CardsIndex() {
  const entries = await Promise.all(
    CARDS.map(async (card) => {
      const content = await getCardContent(card);
      const projects = card.overriddenBy
        ? await listCardProjects(card, content.values)
        : [];
      const overriding = projects.filter((p) => p.overrides.length > 0).length;
      return { card, edited: content.edited, overriding };
    }),
  );

  return (
    <CmsShell
      title="Cards"
      breadcrumbs={
        <span className="inline-flex items-center gap-1">
          <Link href="/admin/pages" className="hover:text-bz-ink">
            Pages
          </Link>
          <ChevronRight size={11} />
          <span>Cards</span>
        </span>
      }
    >
      <div className="flex flex-col gap-5 max-w-[900px]">
        <p className="text-[13px] text-bz-ink-2 leading-relaxed">
          Cards that appear on many pages at once. Edit a card&apos;s words
          here, in English and Arabic, and every page that shows it updates. The
          person or listing a card is about still comes from its record.
        </p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {entries.map(({ card, edited, overriding }) => (
            <li key={card.key}>
              <Link
                href={cardAdminPath(card)}
                className="flex h-full flex-col gap-1 rounded-lg border border-bz-border bg-bz-surface p-4 hover:border-bz-accent transition-colors"
              >
                <span className="text-[13.5px] font-medium">{card.label}</span>
                <span className="mono text-[11px] text-bz-muted">
                  {card.usedOn.map((u) => u.label).join(" · ")}
                </span>
                <span className="mt-1 text-[12px] text-bz-muted">
                  {card.description}
                </span>
                <span className="mt-1 text-[11.5px] text-bz-muted-2">
                  {card.preview ? "Live preview" : "No preview"}
                  {edited ? "" : " · never edited"}
                  {overriding > 0
                    ? ` · ${overriding} project${overriding === 1 ? "" : "s"} with their own wording`
                    : ""}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </CmsShell>
  );
}
