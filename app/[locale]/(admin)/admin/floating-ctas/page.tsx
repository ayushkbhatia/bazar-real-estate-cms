import { CmsShell } from "@/components/brand/cms-shell";
import { requireRole } from "@/lib/auth";
import {
  listCtaClicks,
  listFloatingCtasForAdmin,
} from "@/lib/queries/floating-ctas";
import type { FloatingCtaInput } from "@/lib/schemas/floating-cta";
import { FloatingCtasEditor } from "./_editor";
import { FloatingCtaActivity } from "./_activity";

export const dynamic = "force-dynamic";

const CTA_ROLES = ["admin", "editor", "marketing"] as const;

/**
 * Floating CTAs — the contact buttons that float over every public page.
 *
 * Sibling to Pages & blocks: same idea, applied to the one piece of chrome
 * that isn't part of any page. Reads through the staff client so disabled
 * buttons are visible here (RLS hides them from the public one).
 */
export default async function FloatingCtasPage() {
  const { supabase } = await requireRole(CTA_ROLES);
  const [{ rows, missingTable, error }, clicks] = await Promise.all([
    listFloatingCtasForAdmin(supabase),
    listCtaClicks(supabase),
  ]);

  const initial: FloatingCtaInput[] = rows.map((r) => ({
    id: r.id,
    key: r.key,
    kind: r.kind,
    label: r.label,
    // Mapped as well as selected — this object is explicit, so a column the
    // query loads and this omits reaches the editor as undefined.
    label_ar: r.label_ar ?? null,
    destination: r.destination,
    cc_destination: r.cc_destination,
    message_template: r.message_template,
    message_template_ar: r.message_template_ar ?? null,
    subject_template: r.subject_template,
    subject_template_ar: r.subject_template_ar ?? null,
    scope: r.scope,
    use_advisor_contact: r.use_advisor_contact,
    color: r.color,
    enabled: r.enabled,
  }));

  return (
    <CmsShell title="Floating CTAs" breadcrumbs="Content · Floating CTAs">
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-[14px] font-medium">The contact rail</h2>
          <p className="text-[13px] text-bz-muted max-w-[70ch] mt-1">
            The buttons that float over the site — bottom-right on desktop, a
            dock along the bottom edge on phones. They appear once a visitor
            starts scrolling. Change the text, the number or address behind
            them, and the message the visitor arrives with, without a deploy.
          </p>
        </div>
        {missingTable ? (
          <p className="text-[13px] rounded border border-bz-border bg-bz-surface p-3">
            The <code className="mono">floating_ctas</code> table isn&apos;t
            there yet. Apply migration{" "}
            <code className="mono">0084_floating_ctas.sql</code> and reload —
            the public site keeps showing its built-in defaults until then.
          </p>
        ) : error ? (
          // Anything other than a missing table: don't offer the editor, or a
          // save would write an empty list over the live rail.
          <p className="text-[13px] rounded border border-bz-border bg-bz-surface p-3">
            Couldn&apos;t load the buttons — {error}. Reload to try again; the
            public rail is unaffected.
          </p>
        ) : (
          <FloatingCtasEditor initial={initial} />
        )}
        {missingTable ? null : (
          <FloatingCtaActivity rows={clicks.rows} summary={clicks.summary} />
        )}
      </div>
    </CmsShell>
  );
}
