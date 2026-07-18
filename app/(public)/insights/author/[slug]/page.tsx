import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { PlaceholderImage } from "@/components/brand/placeholder-image";
import { Button } from "@/components/ui/button";
import {
  articleUrl,
  getStaffByPublicSlug,
  listPublishedArticles,
  type ArticleListRow,
} from "@/lib/queries/articles";
import { mediaPublicUrl } from "@/lib/media";
import { getSeedAgentBySlug, SEED_AGENTS } from "@/lib/seeds/agents";

export const revalidate = 300;

export async function generateStaticParams() {
  // SEED_AGENTS covers Sprint 1; Sprint 9 will add real staff slugs.
  return SEED_AGENTS.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const seed = getSeedAgentBySlug(slug);
  if (!seed) return { title: "Author not found" };
  return {
    title: `${seed.display_name} on the Bazar Brief`,
    description: `${seed.display_name}'s articles for the Bazar Brief.`,
  };
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function ArticleHero({ row }: { row: ArticleListRow }) {
  if (row.hero) {
    return (
      <Image
        src={mediaPublicUrl(row.hero.storage_key)}
        alt={row.hero.alt_text ?? row.title}
        fill
        sizes="(min-width: 1280px) 380px, 33vw"
        className="object-cover"
      />
    );
  }
  return (
    <PlaceholderImage
      label={row.title.toLowerCase().slice(0, 26)}
      className="w-full h-full"
    />
  );
}

export default async function InsightsAuthorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const seed = getSeedAgentBySlug(slug);
  // Try DB lookup. Anon RLS may block — fall back to seed data.
  const dbStaff = await getStaffByPublicSlug(slug);
  if (!seed && !dbStaff) notFound();

  const display_name = dbStaff?.display_name ?? seed?.display_name ?? "Author";
  const title = dbStaff?.title ?? seed?.title ?? null;
  const bio = dbStaff?.bio ?? seed?.bio ?? null;

  // Only fetch articles by author_id when we resolved one via DB.
  // Sprint 8 will introduce a public staff view so this works for anon.
  const { rows } = dbStaff
    ? await listPublishedArticles({ authorId: dbStaff.id, limit: 48 })
    : { rows: [] as ArticleListRow[] };

  return (
    <div className="bg-bz-bg">
      {/* Crumb */}
      <div className="px-4 md:px-12 pt-10 max-w-[1280px]">
        <Link
          href="/insights"
          className="inline-flex items-center gap-1.5 text-[12.5px] text-bz-muted hover:text-bz-ink-2 transition-colors"
        >
          <ArrowLeft size={13} strokeWidth={1.8} />
          All insights
        </Link>
      </div>

      {/* Author header */}
      <section className="px-4 md:px-12 pt-8 pb-14 max-w-[1280px]">
        <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-10 items-start">
          <PlaceholderImage
            label={slug}
            className="w-[160px] h-[200px] rounded-md"
          />
          <div>
            <Eyebrow>Author · {title ?? "Bazar"}</Eyebrow>
            <h1
              className="serif text-[30px] md:text-[56px] mt-3 font-normal leading-[1.02]"
              style={{ letterSpacing: "-0.025em" }}
            >
              {display_name}
            </h1>
            {bio ? (
              <p className="mt-5 text-[16px] text-bz-ink-2 leading-relaxed max-w-[60ch]">
                {bio}
              </p>
            ) : null}
            {seed ? (
              <div className="mt-6">
                <Button asChild variant="outline">
                  <Link href={`/agents/${seed.slug}`}>View advisor profile</Link>
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* Articles */}
      <section className="border-t border-bz-border px-4 md:px-12 py-16 max-w-[1280px]">
        <Eyebrow>Articles</Eyebrow>
        <h2
          className="serif text-[32px] mt-2 leading-tight"
          style={{ letterSpacing: "-0.015em" }}
        >
          By {display_name.split(" ")[0]}.
        </h2>

        {rows.length === 0 ? (
          <div className="mt-10 py-12 text-center max-w-[52ch] mx-auto border border-dashed border-bz-border rounded-md">
            <p className="text-[14.5px] text-bz-ink-2">
              {dbStaff
                ? `${display_name} hasn't published any articles yet.`
                : "Author-filtered article archives wire in Sprint 9 once the public staff view lands."}
            </p>
            <Button asChild variant="outline" className="mt-6">
              <Link href="/insights">Browse all insights</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-9 gap-y-14">
            {rows.map((row) => (
              <article key={row.id} className="group">
                <Link href={articleUrl(row)} className="block">
                  <div className="relative aspect-[4/3] rounded overflow-hidden bg-bz-surface-2">
                    <ArticleHero row={row} />
                  </div>
                  <div className="eyebrow mt-3.5">
                    {row.category_label}
                    {row.read_minutes ? ` · ${row.read_minutes} min` : ""}
                  </div>
                  <h3
                    className="serif text-[22px] mt-2 leading-[1.2] group-hover:text-bz-accent transition-colors"
                    style={{ letterSpacing: "-0.01em" }}
                  >
                    {row.title}
                  </h3>
                  {row.excerpt ? (
                    <p className="mt-2 text-[13px] text-bz-ink-2 leading-snug line-clamp-3">
                      {row.excerpt}
                    </p>
                  ) : null}
                  <div className="mt-3 text-[11.5px] text-bz-muted">
                    {row.published_at ? formatDate(row.published_at) : ""}
                  </div>
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
