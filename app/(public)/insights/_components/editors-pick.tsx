import Link from "next/link";
import Image from "next/image";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import {
  articleUrl,
  type ArticleListRow,
} from "@/lib/queries/articles";
import { ARTICLE_CATEGORY_LABELS } from "@/lib/schemas/article";
import { mediaPublicUrl } from "@/lib/media";

/**
 * Sprint 5d (backfilled): "Editor's pick" dark card. Designed to render
 * alongside the newsletter widget on the /insights hero row.
 *
 * Sprint 9 swaps the article-fetch source for a real
 * `articles.flags.editors_pick = true` filter; today the parent picks
 * which article to surface.
 */
export function EditorsPick({ article }: { article: ArticleListRow | null }) {
  if (!article) {
    return (
      <div className="rounded-lg bg-bz-ink text-white p-7">
        <div className="text-[11px] uppercase tracking-widest opacity-60">
          Editor&apos;s pick
        </div>
        <p className="mt-3 text-[14px] opacity-80 leading-relaxed">
          Publish an article and flag it as editor&apos;s pick in
          /admin/blog to see it surface here.
        </p>
      </div>
    );
  }

  return (
    <Link
      href={articleUrl(article)}
      className="group block rounded-lg overflow-hidden bg-bz-ink text-white"
    >
      <div className="relative aspect-[16/9]">
        {article.hero ? (
          <Image
            src={mediaPublicUrl(article.hero.storage_key)}
            alt={article.hero.alt_text ?? article.title}
            fill
            sizes="(min-width: 1280px) 480px, 50vw"
            className="object-cover opacity-90 group-hover:opacity-100 transition-opacity"
          />
        ) : (
          <PlaceholderImage
            label={article.title.toLowerCase().slice(0, 24)}
            dark
            className="w-full h-full"
          />
        )}
      </div>
      <div className="p-6">
        <div className="text-[11px] uppercase tracking-widest opacity-60">
          Editor&apos;s pick · {ARTICLE_CATEGORY_LABELS[article.category]}
        </div>
        <h3
          className="serif text-[22px] mt-2 leading-tight group-hover:text-bz-accent-soft transition-colors"
          style={{ letterSpacing: "-0.012em" }}
        >
          {article.title}
        </h3>
        {article.excerpt ? (
          <p className="mt-3 text-[13px] opacity-75 leading-relaxed line-clamp-3">
            {article.excerpt}
          </p>
        ) : null}
        <div className="mt-4 text-[11px] opacity-60">
          {article.author?.display_name ?? "Bazar"}
          {article.read_minutes ? ` · ${article.read_minutes} min read` : ""}
        </div>
      </div>
    </Link>
  );
}

void Eyebrow;
