import "server-only";
import * as Sentry from "@sentry/nextjs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";
import { formSubmissionTemplate } from "@/lib/email-templates";
import type { Database } from "@/db/types";
import { getFormDef } from "./registry";
import { optionLabel } from "./submission";
import { defaultForm } from "./resolve";

/**
 * The per-form notification list from /admin/forms → Settings.
 *
 * Deliberately additive to Settings → Lead routing rather than a replacement:
 * routing decides which advisor *owns* the lead, this is "also tell these
 * people". A form with an empty list — which is every form until someone types
 * into it — costs one column read that the submission log is already making a
 * round trip for.
 */
async function recipientsFor(
  admin: SupabaseClient<Database>,
  formKey: string,
): Promise<string[]> {
  const { data, error } = await admin
    .from("forms")
    .select("notify_emails")
    .eq("key", formKey)
    .maybeSingle();
  if (error || !data) return [];
  const list = Array.isArray(data.notify_emails) ? data.notify_emails : [];
  return list.map((e) => e.trim()).filter(Boolean);
}

/**
 * `form_submissions.data` → the ordered [label, value] pairs a human reads.
 *
 * Labels come from the row's own `_labels` snapshot, so the email says what
 * the visitor was actually asked even if the question has been renamed since.
 * Values are resolved back to their option label where the form has one —
 * "Sell Your Property", not "sell". Field order follows the form as it stands
 * now, with anything the row carries that the form no longer has appended, so
 * a deleted question's answer is still readable rather than silently dropped.
 */
export function answersFor(
  formKey: string,
  data: Record<string, unknown>,
): [string, string][] {
  const labels =
    data._labels && typeof data._labels === "object" && !Array.isArray(data._labels)
      ? (data._labels as Record<string, string>)
      : {};

  const form = defaultForm(formKey);
  const order = form ? form.fields.map((f) => f.key) : [];
  const keys = [
    ...order.filter((k) => k in data),
    ...Object.keys(data).filter((k) => k !== "_labels" && !order.includes(k)),
  ];

  const out: [string, string][] = [];
  for (const key of keys) {
    const raw = data[key];
    if (raw === null || raw === undefined || raw === "") continue;

    const field = form?.fields.find((f) => f.key === key);
    const display =
      typeof raw === "boolean"
        ? raw
          ? "Yes"
          : "No"
        : field
          ? optionLabel(field, String(raw)) || String(raw)
          : String(raw);

    out.push([labels[key] ?? field?.label ?? key, display]);
  }
  return out;
}

/**
 * Email everyone on a form's notification list.
 *
 * Best-effort and fire-after-the-fact, like the submission log it sits beside:
 * this runs once the lead is already written, so a bounced address or a Resend
 * outage must never turn a captured lead into an error the visitor sees.
 * Failures go to Sentry.
 *
 * Sent one message per recipient rather than one with several `to` addresses,
 * so the desk can't see who else was copied and a single bad address doesn't
 * take the others down with it.
 */
export async function notifyFormRecipients(
  admin: SupabaseClient<Database>,
  entry: {
    formKey: string;
    data: Record<string, unknown>;
    enquiryId?: string | null;
    sourcePath?: string | null;
  },
): Promise<void> {
  try {
    const recipients = await recipientsFor(admin, entry.formKey);
    if (recipients.length === 0) return;

    const def = getFormDef(entry.formKey);
    const template = formSubmissionTemplate({
      formName: def?.name ?? entry.formKey,
      surface: def?.surface ?? "Website",
      formKey: entry.formKey,
      answers: answersFor(entry.formKey, entry.data),
      sourcePath: entry.sourcePath ?? null,
      enquiryId: entry.enquiryId ?? null,
    });

    await Promise.all(
      recipients.map((to) =>
        sendEmail({
          to,
          subject: template.subject,
          text: template.text,
          html: template.html,
        }).catch((err: unknown) => {
          Sentry.captureException(err, {
            tags: { component: "forms/notify" },
            contexts: { form: { key: entry.formKey } },
          });
        }),
      ),
    );
  } catch (err) {
    Sentry.captureException(err, {
      tags: { component: "forms/notify" },
      contexts: { form: { key: entry.formKey } },
    });
  }
}
