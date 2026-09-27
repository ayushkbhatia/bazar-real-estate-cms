"use server";

import { revalidatePath } from "next/cache";
import { revalidateLocalised } from "@/lib/i18n/revalidate";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { requireRole } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import {
  defaultDocument,
  validateSections,
  type StoredSection,
} from "@/lib/master-pages";
import { AGENT_TOKENS, agentPageCopyDef } from "@/lib/master-pages/agent-page";
import { unknownTokenIssues } from "@/lib/master-pages/tokens";
import { agentPageCopySlug } from "@/lib/queries/agent-page";

const PAGE_ROLES = ["admin", "editor", "marketing"] as const;

export type AgentPageCopyResult =
  | { status: "ok"; message: string }
  | { status: "invalid"; message: string; issues: string[] }
  | { status: "error"; message: string };

async function persist(
  sections: StoredSection[],
  action: string,
): Promise<AgentPageCopyResult> {
  const supabase = await createSupabaseServerClient();
  const slug = agentPageCopySlug();

  const { data: existing, error: readError } = await supabase
    .from("pages")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (readError) return { status: "error", message: readError.message };

  const payload = {
    slug,
    title: "Advisor profiles (shared copy)",
    status: "published" as const,
    blocks: sections as unknown as never,
  };

  const write = existing
    ? await supabase
        .from("pages")
        .update(payload)
        .eq("id", existing.id)
        .select("id")
        .maybeSingle()
    : await supabase.from("pages").insert(payload).select("id").maybeSingle();

  if (write.error) return { status: "error", message: write.error.message };
  if (!write.data)
    return {
      status: "error",
      message: "Not saved — your account may not have permission to edit pages.",
    };

  await logAudit({
    action,
    target_kind: "page",
    target_id: write.data.id,
    before: null,
    after: { agent_page_copy: true },
  });

  /*
   * One document, every profile. `"page"` on the dynamic segment invalidates
   * all of them — naming one advisor would leave the rest serving the previous
   * wording until their own window rolled over, which reads as "the save did
   * nothing" on whichever profile the editor checks next.
   */
  revalidateLocalised("/agents/[slug]", "page");
  revalidatePath("/admin/pages/sub/agent/copy");
  revalidatePath("/admin/pages/sub/agent");
  return { status: "ok", message: "Saved." };
}

export async function saveAgentPageCopy(
  _key: string,
  sections: StoredSection[],
): Promise<AgentPageCopyResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  const def = agentPageCopyDef();
  const result = validateSections(def, sections);
  if (!result.ok) {
    return {
      status: "invalid",
      message: "Fix the highlighted fields before saving.",
      issues: result.issues.map(
        (i) => `${i.section} · ${i.field}: ${i.message}`,
      ),
    };
  }
  // A token no profile fills would go live as typed, braces and all, on every
  // /agents/<slug> page at once.
  const tokenIssues = unknownTokenIssues(
    def,
    result.sections,
    Object.values(AGENT_TOKENS),
  );
  if (tokenIssues.length > 0) {
    return {
      status: "invalid",
      message: "A field uses a token advisor pages don't fill in.",
      issues: tokenIssues.map(
        (i) => `${i.section} · ${i.field}: ${i.message}`,
      ),
    };
  }
  return persist(result.sections, "page.agent_copy_update");
}

/** Drop every override — the profiles go back to the copy shipped in code. */
export async function resetAgentPageCopy(
  _key: string,
): Promise<AgentPageCopyResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  return persist(defaultDocument(agentPageCopyDef()), "page.agent_copy_reset");
}
