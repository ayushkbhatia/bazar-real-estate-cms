import { listRecentNotifications } from "@/lib/notifications";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/notifications/recent → { rows, unread, userId }
 *  Returns the current user's 10 most-recent notifications + their unread
 *  count. Used by the topbar bell to populate on mount. */
export async function GET() {
  if (!isSupabaseConfigured) {
    return new Response(
      JSON.stringify({ rows: [], unread: 0, userId: null }),
      { headers: { "content-type": "application/json" } },
    );
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(
      JSON.stringify({ rows: [], unread: 0, userId: null }),
      { headers: { "content-type": "application/json" } },
    );
  }
  // Hand the resolved user over rather than letting the helper look it up
  // again: `cache()` does not memoise in a Route Handler, so without this the
  // one endpoint costs two round-trips to Supabase Auth.
  const { rows, unread } = await listRecentNotifications(10, user);
  return new Response(
    JSON.stringify({ rows, unread, userId: user.id }),
    { headers: { "content-type": "application/json", "cache-control": "no-store" } },
  );
}
