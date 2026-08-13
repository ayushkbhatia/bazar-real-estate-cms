import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import { currentLocale } from "@/lib/i18n/current";
import { localiseRow } from "@/lib/i18n/localise";
import type { Database } from "@/db/types";
import {
  FLOATING_CTA_KINDS,
  FLOATING_CTA_SCOPES,
  type FloatingCtaKind,
  type FloatingCtaScope,
} from "@/lib/schemas/floating-cta";

export type FloatingCtaRow = {
  id: string;
  key: string;
  kind: FloatingCtaKind;
  label: string;
  destination: string | null;
  message_template: string | null;
  /* Arabic twins, present on the admin path and folded away on the public one. */
  label_ar?: string | null;
  message_template_ar?: string | null;
  subject_template_ar?: string | null;
  subject_template: string | null;
  scope: FloatingCtaScope;
  use_advisor_contact: boolean;
  color: string | null;
  enabled: boolean;
  sort_order: number;
};

const COLUMNS =
  "id, key, kind, label, label_ar, destination, message_template, message_template_ar, subject_template, subject_template_ar, scope, use_advisor_contact, color, enabled, sort_order";

/**
 * The rail as it shipped before it was CMS-managed.
 *
 * Used when Supabase is unconfigured (local without env, unit tests) or the
 * migration hasn't been applied yet, so the contact rail never disappears
 * because of an infrastructure gap. Ids are stable strings rather than uuids
 * because nothing writes back to these — they exist only to render.
 */
export const SEED_FLOATING_CTAS: FloatingCtaRow[] = [
  {
    id: "seed-whatsapp",
    key: "whatsapp",
    kind: "whatsapp",
    label: "WhatsApp Bazar",
    destination: null,
    message_template:
      "Hi {advisor}, I'm enquiring about {context} on bazar.ae",
    subject_template: null,
    scope: "all_pages",
    use_advisor_contact: true,
    color: "#25D366",
    enabled: true,
    sort_order: 10,
  },
  {
    id: "seed-call",
    key: "call",
    kind: "call",
    label: "Call",
    destination: null,
    message_template: null,
    subject_template: null,
    scope: "detail_pages",
    use_advisor_contact: true,
    color: null,
    enabled: true,
    sort_order: 20,
  },
  {
    id: "seed-email",
    key: "email",
    kind: "email",
    label: "Email",
    destination: null,
    message_template:
      "Hi {advisor_first},\n\nI'd like to know more about {context}.\n\n{url}",
    subject_template: "Bazar enquiry · {context}",
    scope: "detail_pages",
    use_advisor_contact: true,
    color: null,
    enabled: true,
    sort_order: 30,
  },
];

/** Drop rows whose kind/scope the client doesn't know how to render. */
function narrow(rows: Record<string, unknown>[]): FloatingCtaRow[] {
  return rows.filter(
    (r) =>
      FLOATING_CTA_KINDS.includes(r.kind as FloatingCtaKind) &&
      FLOATING_CTA_SCOPES.includes(r.scope as FloatingCtaScope),
  ) as unknown as FloatingCtaRow[];
}

/**
 * Every enabled CTA, in rail order. Mounted once in the public layout, so this
 * runs on every public request — `cache()` collapses it to one round-trip per
 * render, and RLS already filters `enabled = false` server-side.
 *
 * An empty table returns `[]`: a client who switched every button off gets no
 * rail, which is the point. Only an unreachable table falls back to the seed.
 */
export const listFloatingCtas = cache(async (): Promise<FloatingCtaRow[]> => {
  if (!isSupabaseConfigured) return SEED_FLOATING_CTAS;
  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("floating_ctas")
    .select(COLUMNS)
    .eq("enabled", true)
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });
  if (error) {
    // Table missing (pre-migration) or transient — keep the rail alive.
    console.error("[listFloatingCtas]", error.message);
    return SEED_FLOATING_CTAS;
  }
  // Folded before `narrow`, which builds explicit literals like every other
  // shaper in this codebase.
  const locale = await currentLocale();
  return narrow(
    ((data ?? []) as unknown as Record<string, unknown>[]).map((r) =>
      localiseRow(r, locale),
    ),
  );
});

/**
 * Postgres `undefined_table`, and the PostgREST schema-cache equivalent it
 * arrives as through supabase-js. Only these two mean "apply the migration" —
 * any other failure is transient and must not tell an editor to run DDL.
 */
export function isMissingTableError(error: {
  code?: string | null;
} | null): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

/**
 * Every CTA including disabled ones, for the CMS editor. Uses the caller's
 * authenticated client so the staff RLS policy applies; an anonymous caller
 * would silently see only the enabled subset, which would then be saved back
 * as the complete list and delete the rest.
 */
export async function listFloatingCtasForAdmin(
  supabase: SupabaseClient<Database>,
): Promise<{
  rows: FloatingCtaRow[];
  missingTable: boolean;
  error: string | null;
}> {
  const { data, error } = await supabase
    .from("floating_ctas")
    .select(COLUMNS)
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });
  if (error) {
    console.error("[listFloatingCtasForAdmin]", error.message);
    return {
      rows: [],
      missingTable: isMissingTableError(error),
      error: error.message,
    };
  }
  return {
    rows: narrow((data ?? []) as Record<string, unknown>[]),
    missingTable: false,
    error: null,
  };
}
