"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { currentUserIsAdmin } from "@/lib/queries/staff";
import {
  agentEditSchema,
  normaliseAgentEdit,
  type AgentEditInput,
} from "@/lib/schemas/agent";
import { logAudit } from "@/lib/audit";

type ActionResult =
  | { status: "ok" }
  | {
      status: "error";
      message?: string;
      fieldErrors?: Record<string, string>;
    };

export async function updateAgentAction(
  userId: string,
  input: AgentEditInput,
): Promise<ActionResult> {
  if (!isSupabaseConfigured) {
    return { status: "error", message: "Backend not configured." };
  }
  if (!(await currentUserIsAdmin())) {
    return { status: "error", message: "Admins only." };
  }

  const parsed = agentEditSchema.safeParse(
    normaliseAgentEdit(input as unknown as Record<string, unknown>),
  );
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string") fieldErrors[key] = issue.message;
    }
    return { status: "error", message: "Check the fields.", fieldErrors };
  }

  const supabase = await createSupabaseServerClient();
  const { data: before } = await supabase
    .from("staff")
    .select(
      "display_name, slug, title, brn, bio, photo_url, languages, specialties, credentials",
    )
    .eq("user_id", userId)
    .maybeSingle();

  const { error } = await supabase
    .from("staff")
    .update({
      display_name: parsed.data.display_name,
      slug: parsed.data.slug,
      title: parsed.data.title ?? null,
      brn: parsed.data.brn ?? null,
      bio: parsed.data.bio ?? null,
      photo_url: parsed.data.photo_url ?? null,
      languages: parsed.data.languages,
      specialties: parsed.data.specialties,
      credentials: parsed.data.credentials,
    })
    .eq("user_id", userId);

  if (error) {
    if (error.code === "23505") {
      return {
        status: "error",
        message: "Slug already in use. Pick a different one.",
        fieldErrors: { slug: "Slug already in use" },
      };
    }
    console.error("[updateAgentAction]", error);
    return { status: "error", message: "Could not save." };
  }

  await logAudit({
    action: "staff.update",
    target_kind: "staff",
    target_id: userId,
    before,
    after: parsed.data,
  });

  revalidatePath("/admin/agents");
  revalidatePath(`/admin/agents/${userId}`);
  return { status: "ok" };
}
