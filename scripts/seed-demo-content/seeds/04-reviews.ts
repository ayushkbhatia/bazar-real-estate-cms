/**
 * Seed agent reviews into public.reviews.
 *
 * subject_kind='agent', subject_id=agent.user_id. All seeded reviews
 * land in status='approved' with a moderated_at timestamp so they
 * surface on /agents/[slug] without needing moderation.
 *
 * Idempotency: we identify seeded reviews by a deterministic id
 * (aaaaaaaa-… per lib/ids.ts) and upsert on id.
 */
import { adminClient } from "../lib/client.ts";
import { log } from "../lib/log.ts";
import { countRows } from "../lib/count.ts";
import { makeId } from "../lib/ids.ts";
import { REVIEWS } from "../data/reviews.ts";
import type { SeedContext } from "../index.ts";

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export async function runReviews(ctx: SeedContext): Promise<void> {
  log.step(`Seeding ${REVIEWS.length} reviews`);
  const supabase = adminClient();
  const before = await countRows("reviews");

  let missingAgents = 0;
  for (let i = 0; i < REVIEWS.length; i++) {
    const r = REVIEWS[i];
    if (!r) continue;
    const subjectId = ctx.agents.get(r.agent_slug);
    if (!subjectId) {
      log.warn(`${r.agent_slug} not seeded — skipping review #${i + 1}`);
      missingAgents++;
      continue;
    }
    const createdAt = isoDaysAgo(r.created_days_ago);
    const { error } = await supabase
      .from("reviews")
      .upsert(
        {
          id: makeId("review", i + 1),
          subject_kind: "agent",
          subject_id: subjectId,
          rating: r.rating,
          title: r.title,
          body: r.body,
          author_name: r.author_name,
          author_email: null,
          account_id: null,
          status: "approved",
          moderated_at: createdAt,
          moderated_by: null,
          created_at: createdAt,
          updated_at: createdAt,
        },
        { onConflict: "id" },
      );
    if (error) throw new Error(`upsert review ${r.agent_slug} #${i + 1}: ${error.message}`);
  }
  log.ok(`${REVIEWS.length - missingAgents} reviews written`);
  if (missingAgents > 0) log.warn(`${missingAgents} reviews skipped (agent not seeded)`);

  const after = await countRows("reviews");
  log.summary([{ label: "reviews", before, after }]);
}
