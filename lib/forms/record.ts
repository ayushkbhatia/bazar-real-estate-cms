import "server-only";
import * as Sentry from "@sentry/nextjs";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The submission log.
 *
 * Called from every public form path — the shared renderer's action and the
 * four bespoke handlers (owner wizard, service leads, newsletter, valuation
 * gate) — so /admin/forms → Responses is complete regardless of which
 * component drew the form.
 *
 * Best-effort, and deliberately so: this runs *after* the lead has been
 * written, and a logging failure must never turn a captured lead into an error
 * message. Failures go to Sentry and the visitor sees their confirmation.
 *
 * Writes through the service-role client for the same reason the anonymous
 * enquiry insert does — `form_submissions` has no anon policy, on purpose (see
 * migration 0091), so there is no path for anyone to write rows here except
 * through a form that actually ran.
 */
export async function recordFormSubmission(entry: {
  formKey: string;
  /** Answers keyed by field key, plus `_labels`. */
  data: Record<string, unknown>;
  enquiryId?: string | null;
  sourcePath?: string | null;
}): Promise<void> {
  const admin = createAdminClient();
  if (!admin) return;
  try {
    const { error } = await admin.from("form_submissions").insert({
      form_key: entry.formKey,
      data: entry.data as never,
      enquiry_id: entry.enquiryId ?? null,
      source_path: entry.sourcePath ?? null,
    });
    if (error) {
      // A missing table is the expected state between merging this and
      // applying 0091; it is not worth an alert, and the lead itself landed.
      if (error.code === "42P01" || error.code === "PGRST205") return;
      Sentry.captureException(error, {
        tags: { component: "forms/record" },
        contexts: { form: { key: entry.formKey } },
      });
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: "forms/record" },
      contexts: { form: { key: entry.formKey } },
    });
  }
}

/**
 * The labels snapshot for a bespoke form, whose answers don't come from a
 * `ResolvedForm`. Keeps the shape of `data` identical across every path so the
 * Responses table doesn't need to know which handler produced a row.
 */
export function withLabels(
  answers: Record<string, unknown>,
  labels: Record<string, string>,
): Record<string, unknown> {
  return { ...answers, _labels: labels };
}
