import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export type NotificationKind =
  | "new_enquiry"
  | "viewing_reminder"
  | "lead_reassigned"
  | "system";

export type NotificationRow = {
  id: string;
  user_id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  link: string | null;
  payload: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

export const NOTIFICATION_KIND_LABEL: Record<NotificationKind, string> = {
  new_enquiry: "New enquiry",
  viewing_reminder: "Viewing reminder",
  lead_reassigned: "Lead reassigned",
  system: "System",
};

export type NotificationInsert = {
  user_id: string;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  link?: string | null;
  payload?: Record<string, unknown> | null;
};

/** Insert a notification row. Uses the service-role client so background
 *  jobs (cron + webhooks) can write without an admin session. */
export async function emitNotification(
  entry: NotificationInsert,
): Promise<NotificationRow | null> {
  const admin = createAdminClient();
  if (!admin) {
    console.warn(
      "[emitNotification] service role missing — skipping notification",
      entry.kind,
    );
    return null;
  }
  const { data, error } = await admin
    .from("notifications")
    .insert({
      user_id: entry.user_id,
      kind: entry.kind,
      title: entry.title,
      body: entry.body ?? null,
      link: entry.link ?? null,
      payload: (entry.payload ?? null) as never,
    })
    .select("id, user_id, kind, title, body, link, payload, read_at, created_at")
    .single();
  if (error || !data) {
    console.error("[emitNotification]", error?.message ?? "no data");
    return null;
  }
  return data as unknown as NotificationRow;
}

/** Mark a single notification as read. RLS scopes the update to the
 *  current user. */
export async function markNotificationRead(id: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supabase = await createSupabaseServerClient();
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id);
}

/** Mark all notifications belonging to the current user as read. */
export async function markAllNotificationsRead(): Promise<void> {
  if (!isSupabaseConfigured) return;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("read_at", null);
}

/** List the current user's most-recent notifications + a separate
 *  unread count. */
export async function listRecentNotifications(
  limit = 10,
): Promise<{ rows: NotificationRow[]; unread: number }> {
  if (!isSupabaseConfigured) return { rows: [], unread: 0 };
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { rows: [], unread: 0 };

  const [recent, unread] = await Promise.all([
    supabase
      .from("notifications")
      .select(
        "id, user_id, kind, title, body, link, payload, read_at, created_at",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null),
  ]);

  return {
    rows: (recent.data ?? []) as unknown as NotificationRow[],
    unread: unread.count ?? 0,
  };
}

// ───────────────────────────────────────────────────────────────
// Convenience emitters used by enquiry intake + the viewing cron.
// ───────────────────────────────────────────────────────────────

export type NotifyEnquiryArgs = {
  agent_user_id: string;
  enquiry_id: string;
  preview: string;
  source: string | null;
};

export async function notifyAssignedAgentOfEnquiry(
  args: NotifyEnquiryArgs,
): Promise<void> {
  await emitNotification({
    user_id: args.agent_user_id,
    kind: "new_enquiry",
    title: "New enquiry",
    body: args.preview.slice(0, 200),
    link: `/admin/enquiries/${args.enquiry_id}`,
    payload: {
      enquiry_id: args.enquiry_id,
      source: args.source ?? null,
    },
  });
}

export type NotifyViewingArgs = {
  agent_user_id: string;
  viewing_id: string;
  enquiry_id: string | null;
  scheduled_for: string;
  property_title?: string | null;
};

export async function notifyAgentOfUpcomingViewing(
  args: NotifyViewingArgs,
): Promise<void> {
  const when = new Date(args.scheduled_for);
  const human = Number.isNaN(when.getTime())
    ? "soon"
    : when.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Dubai",
      });
  await emitNotification({
    user_id: args.agent_user_id,
    kind: "viewing_reminder",
    title: `Viewing in 2 hours · ${human}`,
    body: args.property_title
      ? `${args.property_title}`
      : "A viewing is scheduled to start soon.",
    link: args.enquiry_id
      ? `/admin/enquiries/${args.enquiry_id}`
      : "/admin/enquiries",
    payload: {
      viewing_id: args.viewing_id,
      scheduled_for: args.scheduled_for,
    },
  });
}
