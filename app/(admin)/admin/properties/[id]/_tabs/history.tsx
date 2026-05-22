import { Eyebrow } from "@/components/brand/eyebrow";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

type Entry = {
  id: string;
  action: string;
  at: string;
  actor_id: string | null;
  before: unknown;
  after: unknown;
};

/**
 * Sprint 7c (backfilled): History tab on the property editor. Filters
 * the audit log by `target_kind='property' AND target_id=propertyId`,
 * renders a chronological list. Sprint 7i adds the field-level diff
 * visualisation; this tab surfaces the raw entries today.
 */
export async function PropertyHistoryTab({
  propertyId,
}: {
  propertyId: string;
}) {
  if (!isSupabaseConfigured) {
    return <p className="text-[13px] text-bz-muted">Supabase not configured.</p>;
  }
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("audit_log")
    .select("id, action, at, actor_id, before, after")
    .eq("target_kind", "property")
    .eq("target_id", propertyId)
    .order("at", { ascending: false })
    .limit(50);

  const entries = ((data ?? []) as unknown as Entry[]);

  if (entries.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-bz-border bg-bz-surface py-10 text-center">
        <Eyebrow className="text-bz-muted">History</Eyebrow>
        <p className="mt-2 text-[13px] text-bz-ink-2">
          No audit entries yet. Changes to this listing will appear here.
        </p>
      </div>
    );
  }

  // Fetch actor display names in a single follow-up query.
  const actorIds = Array.from(
    new Set(entries.map((e) => e.actor_id).filter((a): a is string => !!a)),
  );
  const { data: staff } =
    actorIds.length > 0
      ? await supabase
          .from("staff")
          .select("user_id, display_name")
          .in("user_id", actorIds)
      : { data: null };
  const nameMap = new Map(
    (staff as { user_id: string; display_name: string }[] | null)?.map((s) => [
      s.user_id,
      s.display_name,
    ]) ?? [],
  );

  return (
    <div>
      <Eyebrow>History · {entries.length} entries</Eyebrow>
      <ul className="mt-4 flex flex-col gap-1.5">
        {entries.map((e) => (
          <li
            key={e.id}
            className="rounded-md border border-bz-border bg-bz-surface px-4 py-2.5 text-[13px]"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-bz-ink">
                <span className="font-medium">
                  {e.actor_id
                    ? (nameMap.get(e.actor_id) ?? "Staff")
                    : "System"}
                </span>{" "}
                <span className="text-bz-ink-2">
                  · {prettyAction(e.action)}
                </span>
              </span>
              <span className="mono text-[11px] text-bz-muted">
                {new Date(e.at).toLocaleString("en-GB", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function prettyAction(action: string): string {
  return action.replace(/_/g, " ").replace(/\./g, " · ");
}
