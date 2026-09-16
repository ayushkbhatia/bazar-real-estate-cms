import type { TokenName } from "./tokens";

/**
 * Form replies — the email a marketing manager chooses as the answer to a
 * public form.
 *
 * Seventeen of the site's twenty-two forms file an enquiry, and every one of
 * them sends the visitor the same acknowledgement. That is a reasonable
 * default and a poor ceiling: a brochure request, a mortgage pre-approval and
 * a "list my property" card are three different conversations, and the desk
 * should be able to answer them differently without a deploy.
 *
 * A form reply is a content asset with `role = 'form_reply'` (migration 0128):
 * a whole-message rich-text email, written in the same editor as the system
 * emails, assigned to one or more forms through `forms.reply_asset_id`.
 *
 * THE RULE: an assigned, PUBLISHED reply replaces the acknowledgement. No
 * assignment, a draft, a trashed row or an unreadable one all send exactly
 * what the site sent before — see ./system-resolve.ts.
 *
 * Pure module: the vocabulary and the starting wording, no database.
 */

/**
 * What a reply may say. The lead tokens every enquiry path fills, plus the
 * two facts the form itself carries — so one reply can serve several forms
 * and still name the one that was filled in.
 *
 * Deliberately no `{{property_reference}}`-only wording in the default: most
 * forms are not on a listing, and `{{property_line}}` disappears when there
 * is nothing to say.
 */
export const FORM_REPLY_TOKENS: readonly TokenName[] = [
  "lead_first_name",
  "lead_name",
  "property_reference",
  "property_title",
  "property_line",
  "enquiry_message",
  "form_name",
  "form_surface",
  "site_url",
];

/** Where a new reply starts: the acknowledgement, in the editor's hands. */
export const FORM_REPLY_DEFAULT = {
  subject: "We received your brief",
  body: [
    "<p>Hello {{lead_first_name}},</p>",
    "<p>Thank you for getting in touch with Bazar.</p>",
    "<p>{{property_line}}</p>",
    "<p>One of our advisors will reach out within <strong>two hours during business hours</strong>, and by next morning otherwise.</p>",
    "<p>Your message:</p>",
    "<blockquote><p>{{enquiry_message}}</p></blockquote>",
    "<p>— Bazar</p>",
  ].join(""),
};

/** Sample values, so a reply previews like any other email in the gallery. */
export const FORM_REPLY_SAMPLE = {
  name: "Amira Haddad",
  message:
    "Is the 3-bed still available for a September move? We'd like to view it this week if possible.",
  propertyReference: "BAZ-AD-04891",
  propertyTitle: "3-bed on Al Reem Island",
  formName: "Submit your enquiry",
  formSurface: "Contact",
};
