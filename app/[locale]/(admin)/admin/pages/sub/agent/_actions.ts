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
import { AGENT_TOKENS } from "@/lib/master-pages/agent-page";
import { agentPageDef } from "@/lib/master-pages/subpages";
import { unknownTokenIssues } from "@/lib/master-pages/tokens";
import { agentPageSlug } from "@/lib/queries/subpages";

const PAGE_ROLES = ["admin", "editor", "marketing"] as const;

export type AgentPageResult =
  | { status: "ok"; message: string }
  | { status: "invalid"; message: string; issues: string[] }
  | { status: "error"; message: string };

type AgentRecord = { user_id: string; display_name: string; slug: string };

/**
 * The advisor behind a profile slug.
 *
 * Any role and status: an editor may prepare the page of an advisor who is
 * not live yet, and the document waits for them. It is filed under the
 * `user_id` — see `getAgentPageContent` for why not the slug.
 */
async function loadRecord(
  slug: string,
): Promise<{ record: AgentRecord | null; message: string | null }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("staff")
    .select("user_id, display_name, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (error) return { record: null, message: error.message };
  if (!data) return { record: null, message: "Advisor not found." };
  return { record: data as AgentRecord, message: null };
}

async function persist(
  record: AgentRecord,
  sections: StoredSection[],
  action: string,
): Promise<AgentPageResult> {
  const supabase = await createSupabaseServerClient();
  const slug = agentPageSlug(record.user_id);

  const { data: existing, error: readError } = await supabase
    .from("pages")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (readError) return { status: "error", message: readError.message };

  const payload = {
    slug,
    title: `${record.display_name} (advisor page)`,
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
    after: { agent: record.slug, sections: sections.length },
  });

  revalidateLocalised(`/agents/${record.slug}`);
  revalidatePath(`/admin/pages/sub/agent/${record.slug}`);
  revalidatePath("/admin/pages/sub/agent");
  return { status: "ok", message: "Saved." };
}

export async function saveAgentPage(
  slug: string,
  sections: StoredSection[],
): Promise<AgentPageResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  const { record, message } = await loadRecord(slug);
  if (!record)
    return { status: "error", message: message ?? "Advisor not found." };

  const def = agentPageDef({ name: record.display_name, slug: record.slug });
  const result = validateSections(def, sections);
  if (!result.ok) {
    return {
      status: "invalid",
      message: "Fix the highlighted fields before saving.",
      issues: result.issues.map((i) => `${i.section} · ${i.field}: ${i.message}`),
    };
  }
  const tokenIssues = unknownTokenIssues(
    def,
    result.sections,
    Object.values(AGENT_TOKENS),
  );
  if (tokenIssues.length > 0) {
    return {
      status: "invalid",
      message: "A field uses a token advisor pages don't fill in.",
      issues: tokenIssues.map((i) => `${i.section} · ${i.field}: ${i.message}`),
    };
  }
  return persist(record, result.sections, "page.agent_update");
}

/** Every band back on, every override cleared — the shared wording renders. */
export async function resetAgentPage(slug: string): Promise<AgentPageResult> {
  if (!isSupabaseConfigured)
    return { status: "error", message: "Supabase env vars are not set." };
  await requireRole(PAGE_ROLES);

  const { record, message } = await loadRecord(slug);
  if (!record)
    return { status: "error", message: message ?? "Advisor not found." };

  return persist(
    record,
    defaultDocument(
      agentPageDef({ name: record.display_name, slug: record.slug }),
    ),
    "page.agent_reset",
  );
}
