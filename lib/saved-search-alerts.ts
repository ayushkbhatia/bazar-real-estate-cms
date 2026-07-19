import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { parseFilters, type PropertyFilters } from "@/lib/filters/property";
import type { Database } from "@/db/types";
import {
  formatPriceAED,
  propertyUrl,
} from "@/lib/queries/property-utils";
import { sendEmail } from "@/lib/email";

export type AlertFrequency = Database["public"]["Enums"]["alert_frequency"];

export type SavedSearchRow = {
  id: string;
  user_id: string;
  name: string;
  mode: Database["public"]["Enums"]["property_mode"] | null;
  query: Record<string, unknown> | null;
  alert_frequency: AlertFrequency;
  last_alert_at: string | null;
};

export type AlertMatch = {
  id: string;
  reference: string;
  slug: string;
  title: string;
  price_aed: number;
  beds: number;
  baths: number;
  built_up_ft2: number | null;
  area_name: string | null;
};

/** Service-role client used by the cron route. Bypasses RLS. */
export function adminSupabase(): SupabaseClient<Database> {
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "saved-search-alerts: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required",
    );
  }
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/**
 * Look up matching properties for one saved search since `since`. Pure-ish:
 * the `supabase` client is injected for testability.
 */
export async function findMatchesForSearch(
  supabase: SupabaseClient<Database>,
  search: SavedSearchRow,
  since: Date,
): Promise<AlertMatch[]> {
  const filters: PropertyFilters = parseFilters(search.query ?? {});

  let q = supabase
    .from("properties")
    .select(
      "id, reference, slug, title, price_aed, beds, baths, built_up_ft2, mode, type, area_id, areas:area_id(name), published_at, status, deleted_at",
    )
    .eq("status", "published")
    .is("deleted_at", null)
    .gte("published_at", since.toISOString())
    .order("published_at", { ascending: false })
    .limit(20);

  if (search.mode) q = q.eq("mode", search.mode);
  if (filters.type) q = q.eq("type", filters.type);
  if (filters.beds != null) {
    if (filters.beds >= 5) q = q.gte("beds", 5);
    else q = q.eq("beds", filters.beds);
  }
  if (filters.baths != null) {
    if (filters.baths >= 4) q = q.gte("baths", 4);
    else q = q.eq("baths", filters.baths);
  }
  if (filters.price_min != null) q = q.gte("price_aed", filters.price_min);
  if (filters.price_max != null) q = q.lte("price_aed", filters.price_max);
  if (filters.q) {
    q = q.textSearch("search_text", filters.q, {
      type: "websearch",
      config: "english",
    });
  }
  if (filters.area) {
    const { data: area } = await supabase
      .from("areas")
      .select("id")
      .eq("slug", filters.area)
      .maybeSingle();
    if (!area) return [];
    q = q.eq("area_id", area.id);
  }

  const { data, error } = await q;
  if (error || !data) return [];
  return data.map((p) => ({
    id: p.id,
    reference: p.reference,
    slug: p.slug,
    title: p.title,
    price_aed: Number(p.price_aed),
    beds: p.beds,
    baths: p.baths,
    built_up_ft2: p.built_up_ft2,
    area_name:
      ((p.areas as unknown) as { name: string } | null)?.name ?? null,
  }));
}

/** "Since when should this saved-search look for matches?" — falls back
 *  to 7 days ago when the user has never been alerted before. */
export function alertWindowStart(
  lastAlertAt: string | null,
  frequency: AlertFrequency,
  now: Date,
): Date {
  if (lastAlertAt) return new Date(lastAlertAt);
  const fallbackDays = frequency === "weekly" ? 7 : 1;
  return new Date(now.getTime() - fallbackDays * 24 * 60 * 60_000);
}

export function alertEmailTemplate(opts: {
  searchName: string;
  matches: AlertMatch[];
  manageUrl: string;
}): { subject: string; text: string; html: string } {
  const subject = `${opts.matches.length} new match${
    opts.matches.length === 1 ? "" : "es"
  } for "${opts.searchName}"`;

  const textLines = opts.matches.map((m) => {
    const loc = m.area_name ? ` · ${m.area_name}` : "";
    return `• ${formatPriceAED(m.price_aed)} · ${m.title}${loc} (${m.beds} bd / ${m.baths} ba)\n  ${m.reference} — see ${propertyUrl(m)}`;
  });
  const text =
    `Hi,\n\nNew matches against your saved search "${opts.searchName}":\n\n` +
    textLines.join("\n\n") +
    `\n\nManage searches: ${opts.manageUrl}\n\n— Bazar Real Estate`;

  const items = opts.matches
    .map((m) => {
      const loc = m.area_name ? ` · ${escapeHtml(m.area_name)}` : "";
      return `<li style="padding:10px 0;border-bottom:1px solid #E5E5DF">
        <a href="${escapeHtml(propertyUrl(m))}" style="color:#1B1A17;text-decoration:none">
          <div style="font-weight:500">${formatPriceAED(m.price_aed)} · ${escapeHtml(m.title)}</div>
          <div style="font-size:12px;color:#5a5a55;margin-top:2px">${m.beds} bd · ${m.baths} ba${loc} · <span style="font-family:ui-monospace,monospace">${escapeHtml(m.reference)}</span></div>
        </a>
      </li>`;
    })
    .join("");

  const html = `<!doctype html><html><body style="margin:0;padding:0;background:#FAFAF6;color:#1B1A17;font-family:'Geist',ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.55">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width:540px;margin:0 auto;padding:24px">
<tr><td>
  <div style="font-family:Georgia,serif;font-style:italic;font-size:22px;letter-spacing:-0.01em;margin-bottom:8px">Bazar</div>
  <h1 style="font-family:Georgia,serif;font-style:italic;font-weight:400;font-size:24px;line-height:1.2;margin:8px 0 16px">New matches for &ldquo;${escapeHtml(opts.searchName)}&rdquo;</h1>
  <ul style="list-style:none;padding:0;margin:0">${items}</ul>
  <p style="margin-top:24px;font-size:12px;color:#99896e">
    <a href="${escapeHtml(opts.manageUrl)}" style="color:#99896e">Manage your saved searches →</a>
  </p>
</td></tr></table></body></html>`;

  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );
}

export async function runSavedSearchAlerts(
  frequency: AlertFrequency,
): Promise<{ processed: number; emailed: number; matched: number }> {
  if (frequency === "off") return { processed: 0, emailed: 0, matched: 0 };

  const supabase = adminSupabase();
  const now = new Date();

  const { data: searches } = await supabase
    .from("saved_searches")
    .select(
      "id, user_id, name, mode, query, alert_frequency, last_alert_at",
    )
    .eq("alert_frequency", frequency);

  if (!searches || searches.length === 0)
    return { processed: 0, emailed: 0, matched: 0 };

  let emailed = 0;
  let totalMatches = 0;

  for (const raw of searches) {
    const search = raw as unknown as SavedSearchRow;
    const since = alertWindowStart(
      search.last_alert_at,
      search.alert_frequency,
      now,
    );
    const matches = await findMatchesForSearch(supabase, search, since);

    totalMatches += matches.length;

    // Stamp last_alert_at even if no matches — so we don't re-scan the same
    // window forever.
    await supabase
      .from("saved_searches")
      .update({ last_alert_at: now.toISOString() })
      .eq("id", search.id);

    if (matches.length === 0) continue;

    const { data: authUser } = await supabase.auth.admin.getUserById(
      search.user_id,
    );
    const email = authUser?.user?.email;
    if (!email) continue;

    const base = (
      env.NEXT_PUBLIC_SITE_URL ?? "https://bazar-real-estate-cms.vercel.app"
    ).replace(/\/+$/, "");
    const tpl = alertEmailTemplate({
      searchName: search.name,
      matches,
      manageUrl: `${base}/account/saved`,
    });
    const r = await sendEmail({
      to: email,
      subject: tpl.subject,
      text: tpl.text,
      html: tpl.html,
    });
    if (r.status === "ok") emailed++;
  }

  return { processed: searches.length, emailed, matched: totalMatches };
}
