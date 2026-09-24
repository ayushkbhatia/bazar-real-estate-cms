import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import {
  CARDS_ADMIN_PATH,
  CARD_SOURCES,
  cardSection,
  getCard,
} from "@/lib/master-pages/cards";
import { getCardContent, listCardProjects } from "@/lib/queries/cards";
import { CardEditor } from "./_card-editor";
import { OverridesPanel } from "./_overrides-panel";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ key: string }> };

export default async function CardEditorPage({ params }: PageProps) {
  const { key } = await params;
  const card = getCard(key);
  if (!card) notFound();

  const section = cardSection(card);
  const source = CARD_SOURCES[card.source];
  const content = await getCardContent(card);
  const projects = await listCardProjects(card, content.values);
  const overriding = projects.filter((p) => p.overrides.length > 0);

  return (
    <CmsShell
      title={card.label}
      breadcrumbs={
        <span className="inline-flex items-center gap-1">
          <Link href="/admin/pages" className="hover:text-bz-ink">
            Pages
          </Link>
          <ChevronRight size={11} />
          <Link href={CARDS_ADMIN_PATH} className="hover:text-bz-ink">
            Cards
          </Link>
          <ChevronRight size={11} />
          <span>{card.label}</span>
        </span>
      }
      secondary={
        <Link
          href={card.usedOn[0]?.href ?? "/"}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-bz-muted hover:text-bz-ink"
        >
          View on the site
          <ExternalLink size={12} />
        </Link>
      }
    >
      <div className="flex flex-col gap-5 max-w-[1100px]">
        {/*
          The blast radius and the other door, before the form. This card is a
          view onto a section of a shared document, so an editor who later
          opens that document's own screen should not be surprised to find the
          same words there.
        */}
        <div className="rounded-lg border border-bz-border bg-bz-surface-2 p-4">
          <h2 className="text-[13.5px] font-medium">
            One edit, {card.usedOn.map((u) => u.label).join(" and ")}
          </h2>
          <p className="mt-1 text-[12.5px] text-bz-ink-2 leading-relaxed">
            {card.description} Type the Arabic under each English field; a box
            left blank shows the wording the site shipped with.
          </p>
          <p className="mt-2 text-[12.5px] text-bz-ink-2 leading-relaxed">
            {card.recordNote}{" "}
            <Link href={card.recordLink.href} className="text-bz-ink underline">
              {card.recordLink.label}
            </Link>
            .
          </p>
          <p className="mt-2 text-[12.5px] text-bz-ink-2 leading-relaxed">
            Write{" "}
            {card.tokens.map((t, i) => (
              <span key={t}>
                {i > 0 ? (i === card.tokens.length - 1 ? " or " : ", ") : ""}
                <span className="mono">{t}</span>
              </span>
            ))}{" "}
            anywhere in a field and each page fills in its own value — the
            project&apos;s or listing&apos;s name, the advisor&apos;s name, and
            so on. These are the same words as the{" "}
            <Link href={source.adminPath} className="text-bz-ink underline">
              {section.label}
            </Link>{" "}
            section of {source.label} — edit them in either place.
          </p>
        </div>

        <CardEditor
          // Remount when the stored wording changes, so a reset (or a save
          // made in the other screen) is what the form shows after refresh.
          key={JSON.stringify(content.values)}
          cardKey={card.key}
          cardLabel={card.label}
          section={section}
          initialValues={content.values}
          edited={content.edited}
          preview={card.preview}
          projects={projects.map((p) => ({
            slug: p.slug,
            name: p.name,
            published: p.published,
            tokens: p.tokens,
            advisor: p.advisor,
            values: p.values,
          }))}
        />

        {card.overriddenBy ? (
          <OverridesPanel
            cardKey={card.key}
            total={projects.length}
            rows={overriding.map((p) => ({
              slug: p.slug,
              name: p.name,
              published: p.published,
              overrides: p.overrides,
            }))}
          />
        ) : null}
      </div>
    </CmsShell>
  );
}
