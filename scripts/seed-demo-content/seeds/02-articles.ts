/**
 * Seed ten editorial articles into public.articles.
 *
 * Idempotency: keyed on slug. Re-running updates body / excerpt / SEO
 * but leaves published_at stable so the ordering on /insights doesn't
 * shuffle every run.
 *
 * Author rotation: each article points at a seeded advisor whose
 * specialty fits the topic. If the seeded staff row isn't found
 * (e.g. agents seeder was skipped) we warn and leave author_id null.
 */
import { adminClient } from "../lib/client.ts";
import { log } from "../lib/log.ts";
import { countRows } from "../lib/count.ts";
import { makeId } from "../lib/ids.ts";
import { ARTICLES } from "../data/articles.ts";
import type { SeedContext } from "../index.ts";

export async function runArticles(ctx: SeedContext): Promise<void> {
  log.step("Seeding 10 articles (insights blog)");
  const supabase = adminClient();
  const before = await countRows("articles", { col: "status", val: "published" });

  for (let i = 0; i < ARTICLES.length; i++) {
    const article = ARTICLES[i];
    if (!article) continue;
    const authorId = ctx.agents.get(article.author_slug) ?? null;
    if (!authorId) {
      log.warn(`${article.slug} · author ${article.author_slug} not seeded, leaving author_id null`);
    }
    const publishedAt = new Date();
    publishedAt.setDate(publishedAt.getDate() - article.published_days_ago);

    // Use a deterministic id so the row is upserted, not duplicated.
    // Indexing starts at 11 to leave room for the existing 3 articles
    // (which use 55555555-…-00000001/2/3).
    const id = makeId("article", 11 + i);

    const { error } = await supabase
      .from("articles")
      .upsert(
        {
          id,
          slug: article.slug,
          title: article.title,
          excerpt: article.excerpt,
          category: article.category,
          status: "published",
          author_id: authorId,
          hero_image_id: null,
          body_html: article.body_html,
          read_minutes: article.read_minutes,
          seo: article.seo,
          published_at: publishedAt.toISOString(),
        },
        { onConflict: "slug" },
      );
    if (error) throw new Error(`upsert article ${article.slug}: ${error.message}`);
    log.ok(`${article.category.padEnd(15)} · ${article.slug}`);
  }

  const after = await countRows("articles", { col: "status", val: "published" });
  log.summary([{ label: "articles (published)", before, after }]);
}
