import { FORM_DEFS } from "@/lib/forms/registry";
import type { FormDef } from "@/lib/forms/types";
import type { PreviewOnlyEmailKey, SystemAssetKey } from "./system";

/**
 * Where each email is used — which form, on which page, at which route.
 *
 * "What does this email say?" was answerable from the gallery the moment 0127
 * landed. "Who gets it, and from where?" was not: the mapping between the
 * twenty-two public forms and the emails that answer them lived in the send
 * paths, so a marketing manager editing the enquiry acknowledgement could not
 * see that it is what eighteen different boxes on eleven pages send.
 *
 * Derived, not typed out. The form half is computed from the registry, so a
 * form added in code appears here without anyone remembering to; the rest is
 * the list of triggers that are not forms at all — a cron, an admin button,
 * a tool — which have to be stated because no registry describes them.
 */

export type EmailSurface = {
  /** What it is, in the words the admin would use. */
  label: string;
  /** The public page it sits on, when it has one. */
  path?: string;
  /** Where in the CMS it is configured. */
  adminPath?: string;
  /** Why it fires, when the label does not say it. */
  note?: string;
};

/**
 * Which email a form sends to the visitor when nothing is assigned.
 *
 * `lead` forms all file an enquiry and share the acknowledgement — except the
 * mortgage desk's, which has its own. `newsletter` and `valuation` forms send
 * an email that carries a link or a code the visitor must act on, which is
 * why neither is assignable: a reply with no confirm link would break the
 * signup it was written for.
 */
export type FormEmailRouting =
  | { kind: "lead"; defaultEmail: SystemAssetKey; assignable: true }
  | { kind: "newsletter"; defaultEmail: SystemAssetKey; assignable: false; why: string }
  | { kind: "valuation"; defaultEmail: SystemAssetKey; assignable: false; why: string };

export function formEmailRouting(def: FormDef): FormEmailRouting {
  if (def.handler === "newsletter") {
    return {
      kind: "newsletter",
      defaultEmail: "newsletter_confirmation",
      assignable: false,
      why: "A signup has to be confirmed before anyone is subscribed, so this email is the confirmation link itself. Edit the wording on the email.",
    };
  }
  if (def.handler === "valuation") {
    return {
      kind: "valuation",
      defaultEmail: "valuation_code",
      assignable: false,
      why: "This form sends a one-time code, then a second email once it is entered. Edit the wording on each email.",
    };
  }
  return {
    kind: "lead",
    defaultEmail:
      def.enquirySource === "mortgage" ? "mortgage_enquiry_ack" : "enquiry_auto_reply",
    assignable: true,
  };
}

/** Every public form, in the manager's order. */
export function allForms(): FormDef[] {
  return FORM_DEFS;
}

/** Forms whose reply an editor may choose. */
export function assignableForms(): FormDef[] {
  return FORM_DEFS.filter((f) => formEmailRouting(f).assignable);
}

/** One form as a surface line: "Contact · /contact". */
export function formSurface(def: FormDef): EmailSurface {
  return {
    label: `${def.name} · ${def.surface}`,
    path: def.path,
    adminPath: `/admin/forms/${def.key}`,
  };
}

/**
 * The forms that send this email today — minus any whose reply has been
 * pointed elsewhere, because those no longer send it.
 *
 * `assignments` is form key → assigned asset id, as stored on `forms`.
 */
export function formsSending(
  key: SystemAssetKey,
  assignments: Record<string, string | null> = {},
): FormDef[] {
  return FORM_DEFS.filter((def) => {
    const routing = formEmailRouting(def);
    if (routing.assignable && assignments[def.key]) return false;
    if (routing.defaultEmail === key) return true;
    // The welcome goes out after the confirmation link is clicked, so the
    // newsletter forms are where it starts even though they do not send it.
    return key === "newsletter_welcome" && routing.kind === "newsletter";
  });
}

/**
 * Triggers that are not forms: a cron, an admin button, a tool's second step.
 * Hand-written because nothing in the codebase enumerates them, and stated
 * per email so the gallery can answer "where does this come from?" for all of
 * them rather than most of them.
 */
const STATIC_SURFACES: Record<SystemAssetKey | PreviewOnlyEmailKey, EmailSurface[]> = {
  enquiry_auto_reply: [
    {
      label: "Auto-reply sweep",
      adminPath: "/admin/enquiries",
      note: "A cron catches any lead the form path failed to acknowledge.",
    },
  ],
  mortgage_enquiry_ack: [],
  valuation_request_ack: [
    { label: "Valuation tool", path: "/tools/valuation", adminPath: "/admin/valuations" },
  ],
  valuation_code: [{ label: "Valuation tool · full report", path: "/tools/valuation" }],
  valuation_report_requested: [
    { label: "Valuation tool · after the code", path: "/tools/valuation" },
  ],
  valuation_report: [
    {
      label: "Send report",
      adminPath: "/admin/valuations",
      note: "An advisor sends the refined figure by hand.",
    },
  ],
  valuation_nurture_day7: [
    { label: "Nurture cron · day 7", adminPath: "/admin/valuations" },
  ],
  valuation_nurture_day30: [
    { label: "Nurture cron · day 30", adminPath: "/admin/valuations" },
  ],
  newsletter_confirmation: [],
  newsletter_welcome: [
    {
      label: "Confirmation link",
      note: "Sent when the subscriber clicks the link in the confirmation email.",
    },
  ],
  staff_invitation: [{ label: "Invite a team member", adminPath: "/admin/users" }],
  staff_password_reset: [
    { label: "Forgotten password", path: "/forgot-password" },
    { label: "Send a password link", adminPath: "/admin/users" },
  ],
  enquiry_escalation: [
    {
      label: "Escalation cron",
      adminPath: "/admin/enquiries",
      note: "An enquiry unassigned for an hour.",
    },
  ],
  permit_expiry_warning: [
    { label: "Permit-expiry cron", adminPath: "/admin/properties" },
  ],
  bulk_reassign_digest: [
    { label: "Bulk reassign", adminPath: "/admin/properties" },
  ],
  form_submission_notification: [
    {
      label: "Every form with a notification list",
      adminPath: "/admin/forms",
      note: "Goes to the addresses on that form's list, not to the visitor.",
    },
  ],
  advisor_reply: [
    { label: "Enquiry composer", adminPath: "/admin/enquiries" },
  ],
};

export function staticSurfaces(
  key: SystemAssetKey | PreviewOnlyEmailKey,
): EmailSurface[] {
  return STATIC_SURFACES[key] ?? [];
}

/**
 * Everything that sends this email, forms first. What the gallery card
 * summarises and the editor lists in full.
 */
export function emailSurfaces(
  key: SystemAssetKey | PreviewOnlyEmailKey,
  assignments: Record<string, string | null> = {},
): EmailSurface[] {
  const forms =
    key in STATIC_SURFACES && isSystemKey(key)
      ? formsSending(key, assignments).map(formSurface)
      : [];
  return [...forms, ...staticSurfaces(key)];
}

function isSystemKey(
  key: SystemAssetKey | PreviewOnlyEmailKey,
): key is SystemAssetKey {
  return key !== "advisor_reply";
}
