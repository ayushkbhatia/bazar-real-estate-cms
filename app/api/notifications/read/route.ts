import { NextRequest } from "next/server";
import { z } from "zod";
import {
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  id: z.string().uuid().nullable().optional(),
  /** When true, mark every notification of the current user as read. */
  all: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  if (!isSupabaseConfigured) {
    return new Response("Unavailable", { status: 503 });
  }
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid body" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  if (parsed.data.all) {
    await markAllNotificationsRead();
  } else if (parsed.data.id) {
    await markNotificationRead(parsed.data.id);
  } else {
    return new Response(JSON.stringify({ error: "Pass id or all=true" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" },
  });
}
