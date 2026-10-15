import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { Database } from "@/db/types";

type SubscriberStatus = Database["public"]["Enums"]["newsletter_status"];

export type SubscriberCounts = Record<SubscriberStatus, number> & {
  total: number;
  /** Confirmed, by language — what each audience would reach today. */
  confirmedEn: number;
  confirmedAr: number;
};

/** Head counts, so the numbers are right however long the list grows. */
export async function subscriberCounts(): Promise<SubscriberCounts> {
  const empty: SubscriberCounts = {
    pending: 0,
    confirmed: 0,
    unsubscribed: 0,
    bounced: 0,
    total: 0,
    confirmedEn: 0,
    confirmedAr: 0,
  };
  if (!isSupabaseConfigured) return empty;
  const supabase = await createSupabaseServerClient();
  const count = async (filter: (q: ReturnType<typeof base>) => ReturnType<typeof base>) => {
    const { count: n } = await filter(base());
    return n ?? 0;
  };
  function base() {
    return supabase.from("newsletter_subscribers").select("id", { count: "exact", head: true });
  }
  const [pending, confirmed, unsubscribed, bounced, confirmedAr] = await Promise.all([
    count((q) => q.eq("status", "pending")),
    count((q) => q.eq("status", "confirmed")),
    count((q) => q.eq("status", "unsubscribed")),
    count((q) => q.eq("status", "bounced")),
    count((q) => q.eq("status", "confirmed").eq("locale", "ar")),
  ]);
  return {
    pending,
    confirmed,
    unsubscribed,
    bounced,
    total: pending + confirmed + unsubscribed + bounced,
    confirmedAr,
    confirmedEn: confirmed - confirmedAr,
  };
}

export async function campaignCount(): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  const supabase = await createSupabaseServerClient();
  const { count } = await supabase.from("newsletter_campaigns").select("id", { count: "exact", head: true });
  return count ?? 0;
}
