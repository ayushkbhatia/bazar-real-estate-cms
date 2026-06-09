import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import {
  articleUrl,
  listPublishedArticles,
  type ArticleListRow,
} from "@/lib/queries/articles";
import { ARTICLE_CATEGORY_LABELS } from "@/lib/schemas/article";
import { mediaPublicUrl } from "@/lib/media";
import { NewsletterSignup } from "./newsletter-signup";

function ArticleImage({ row }: { row: ArticleListRow }) {
  if (row.hero) {
    return (
      <Image
        src={mediaPublicUrl(row.hero.storage_key)}
        alt={row.hero.alt_text ?? row.title}
        fill
        sizes="(min-width: 1280px) 600px, 50vw"
        className="object-cover"
      />
    );
  }
  return (
    <PlaceholderImage
      label={row.title.toLowerCase().slice(0, 24)}
      className="w-full h-full"
    />
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

/**
 * Sprint 4a: home-page insights teaser. Large lead + 4 stacked + newsletter.
 */
export async function InsightsTeaser() {
  const { rows } = await listPublishedArticles({ limit: 5 });
  const lead = rows[0];
  const rest = rows.slice(1, 5);

  return (
    <section className="border-y border-bz-border bg-bz-surface">
      <div className="px-4 md:px-12 py-12 md:py-20">
        <div className="flex items-end justify-between gap-8 flex-wrap mb-10">
          <div>
            <Eyebrow>The Bazar Brief</Eyebrow>
            <h2
              className="serif text-[28px] md:text-[40px] mt-2 leading-tight max-w-[26ch]"
              style={{ letterSpacing: "-0.022em" }}
            >
              Field notes, market reports, and the occasional contrarian take.
            </h2>
          </div>
          <Link
            href="/insights"
            className="inline-flex items-center gap-1.5 text-[13px] text-bz-ink-2 hover:text-bz-accent transition-colors"
          >
            All insights
            <ArrowRight size={13} strokeWidth={1.7} />
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr_1fr] gap-8">
          {/* Lead article */}
          {lead ? (
            <Link href={articleUrl(lead)} className="group block">
              <div className="relative aspect-[16/10] rounded-lg overflow-hidden bg-bz-surface-2">
                <ArticleImage row={lead} />
              </div>
              <div className="mt-5">
                <Eyebrow>{ARTICLE_CATEGORY_LABELS[lead.category]}</Eyebrow>
                <h3
                  className="serif text-[24px] md:text-[32px] mt-2 leading-[1.08] group-hover:text-bz-accent transition-colors max-w-[22ch]"
                  style={{ letterSpacing: "-0.018em" }}
                >
                  {lead.title}
                </h3>
                {lead.excerpt ? (
                  <p className="mt-3 text-[14px] text-bz-ink-2 leading-relaxed line-clamp-3 max-w-[58ch]">
                    {lead.excerpt}
                  </p>
                ) : null}
                <div className="mt-4 text-[11.5px] text-bz-muted">
                  {lead.author?.display_name ?? "Bazar"}
                  {lead.published_at ? ` · ${formatDate(lead.published_at)}` : ""}
                </div>
              </div>
            </Link>
          ) : (
            <ArticlePlaceholder featured />
          )}

          {/* Stacked 4 */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
            {rest.length === 0
              ? Array.from({ length: 4 }).map((_, i) => (
                  <ArticlePlaceholder key={i} />
                ))
              : rest.map((row) => (
                  <Link
                    key={row.id}
                    href={articleUrl(row)}
                    className="group block border-t border-bz-border pt-5"
                  >
                    <div className="eyebrow">
                      {ARTICLE_CATEGORY_LABELS[row.category]}
                    </div>
                    <h4
                      className="serif text-[18px] mt-1 leading-tight group-hover:text-bz-accent transition-colors line-clamp-2"
                      style={{ letterSpacing: "-0.008em" }}
                    >
                      {row.title}
                    </h4>
                    <div className="mt-2 text-[11px] text-bz-muted">
                      {row.published_at ? formatDate(row.published_at) : ""}
                      {row.read_minutes ? ` · ${row.read_minutes} min` : ""}
                    </div>
                  </Link>
                ))}
          </div>
        </div>

        {/* Newsletter card */}
        <div className="mt-12 bg-bz-ink text-white rounded-lg p-6 md:p-8 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 md:gap-10 items-center">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-white/60">
              Subscribe to the Brief
            </div>
            <h3
              className="serif text-[26px] mt-2 leading-tight max-w-[36ch]"
              style={{ letterSpacing: "-0.012em" }}
            >
              One email every Wednesday. ~14,400 readers across Abu Dhabi,
              Riyadh, and London.
            </h3>
          </div>
          <div className="w-full md:w-[360px]">
            <NewsletterSignup source="homepage" variant="dark" />
          </div>
        </div>
      </div>
    </section>
  );
}

function ArticlePlaceholder({ featured = false }: { featured?: boolean }) {
  return (
    <div className={featured ? "" : "border-t border-bz-border pt-5"}>
      {featured ? (
        <div className="relative aspect-[16/10] rounded-lg overflow-hidden bg-bz-surface-2">
          <PlaceholderImage label="article" className="w-full h-full" />
        </div>
      ) : null}
      <div className={featured ? "mt-5" : ""}>
        <Eyebrow>{featured ? "Market report" : "Field note"}</Eyebrow>
        <h3
          className={
            featured
              ? "serif text-[28px] mt-2 leading-tight max-w-[22ch]"
              : "serif text-[18px] mt-1 leading-tight"
          }
        >
          Articles land once you seed the editorial schema.
        </h3>
      </div>
    </div>
  );
}
