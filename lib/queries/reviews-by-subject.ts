/**
 * Approved reviews for a subject (typically an agent).
 *
 * Used by `app/[locale]/(public)/agents/[slug]/page.tsx` to surface advisor
 * testimonials. RLS policy `reviews_public_read` already filters to
 * status='approved', but we keep the predicate explicit so the query
 * is self-documenting.
 */
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";

export type ApprovedReview = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  author_name: string | null;
  created_at: string;
};

export async function listApprovedReviewsForAgent(
  userId: string,
  opts: { limit?: number } = {},
): Promise<ApprovedReview[]> {
  if (!isSupabaseConfigured || !userId) return [];
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("id, rating, title, body, author_name, created_at")
    .eq("subject_kind", "agent")
    .eq("subject_id", userId)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 6);
  if (error || !data) return [];
  return data as ApprovedReview[];
}
