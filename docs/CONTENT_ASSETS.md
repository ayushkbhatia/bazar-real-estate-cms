# Content Assets

Everything Bazar sends to a person, in one place: `/admin/content-assets`.

Five tabs:

| Tab | Route | What it is |
|---|---|---|
| **Site emails** (default) | `/admin/content-assets` | Every email the site sends on its own — 18 of them — each drawn as it actually arrives, rewritable in a rich-text editor |
| **Form replies** | `/admin/content-assets/replies` | Every public form, the email its visitor receives, and which reply answers which form |
| **Outreach** | `?view=outreach` | Email and WhatsApp copy an advisor sends by hand from the enquiry composer |
| **Email design** | `/admin/content-assets/design` | The logo, colours and footer every email is wrapped in |
| **Trash** | `?view=trash` | Deleted outreach assets |

`?view=system`, the old address of the emails tab, still lands on it.

## Site emails vs outreach

| | **Outreach** | **Site emails** |
|---|---|---|
| Who sends it | an advisor, by hand | the site, with nobody watching |
| Where it is used | the enquiry composer | seventeen send paths (below) |
| Channels | email + WhatsApp | email only |
| Body is | plain text, the **middle** of a message — `staffReplyTemplate` adds greeting and signature | rich text (HTML), the **whole** message; only the brand header and footer are added |
| Draft means | it does not appear in the composer | Bazar's built-in wording sends |
| Published means | advisors can pick it | this wording sends instead of the built-in |
| Can be deleted | yes, via trash | **no** |
| Editor | `/admin/content-assets/<id>` | `/admin/content-assets/emails/<key>` |

## The inventory

`lib/content-assets/system.ts` is the registry. Every entry carries its label,
audience, trigger, recipient, where the built-in lives, its token scope and
its required tokens.

### To leads and clients

| Key | Sends when | Built-in |
|---|---|---|
| `enquiry_auto_reply` | any enquiry form is submitted, plus the auto-reply cron sweep | `enquiryReceivedTemplate` |
| `mortgage_enquiry_ack` | the pre-approval form under `/tools/mortgage` — falls back to `enquiry_auto_reply` | *(none — see below)* |
| `valuation_request_ack` | an owner completes `/tools/valuation` | `valuationReceivedTemplate` |
| `valuation_code` | an owner asks for the full report (one-time code) | `valuationCodeTemplate` |
| `valuation_report_requested` | the owner enters that code | `valuationReportRequestedTemplate` |
| `valuation_report` | an advisor clicks Send report in `/admin/valuations` | `valuationReportTemplate` |
| `valuation_nurture_day7` | nurture cron, a week after the report | `valuationNurtureDay7Template` |
| `valuation_nurture_day30` | nurture cron, a month after the report | `valuationNurtureDay30Template` |
| `viewing_confirmation` | an advisor books a viewing (with the `.ics` attached) | `viewingConfirmationTemplate` |
| `newsletter_confirmation` | a newsletter signup (double opt-in) | `newsletterConfirmTemplate` |
| `newsletter_welcome` | the subscriber clicks the confirmation link | `newsletterWelcomeTemplate` |
| *advisor reply* | an advisor replies from the enquiry composer | `staffReplyTemplate` — **preview only**, the advisor writes the body |

### To the team

| Key | Sends when | Built-in |
|---|---|---|
| `staff_invitation` | an admin invites someone from `/admin/users` | `staffInvitationTemplate` |
| `staff_password_reset` | `/forgot-password`, or an admin sends a password link | `staffPasswordResetTemplate` |
| `enquiry_escalation` | escalation cron: an enquiry unassigned for an hour | `enquiryEscalationTemplate` |
| `permit_expiry_warning` | permit-expiry cron: a listing permit within 30 days of lapsing | `permitExpiryWarningTemplate` |
| `bulk_reassign_digest` | a bulk reassign puts listings in an advisor's queue | `bulkReassignDigestTemplate` |
| `form_submission_notification` | a form with a notification list is submitted | `formSubmissionTemplate` |

Built-ins live in `lib/email-templates.ts` (the two newsletter ones in
`lib/newsletter-templates.ts`).

### Not sent

The gallery says so, so an absence reads as a decision:

- **Customer sign-up, sign-in and magic-link emails.** There are no customer
  accounts (ADR-0005) and nothing asks Supabase Auth to send mail. The team's
  only sign-in email is `staff_password_reset`.
- **Viewing reminders to the lead.** The two-hour reminder is an in-app
  notification to the advisor.

## Form replies

Seventeen of the twenty-two public forms file an enquiry, and all of them sent
the same acknowledgement. A **form reply** is a content asset with
`role = 'form_reply'` (migration 0128) — a whole-message rich-text email,
written in the same editor as a system email, that a marketing manager assigns
to one or more forms. So a brochure gate can answer differently from a
mortgage enquiry without a deploy.

- **The mapping** — `/admin/content-assets/replies` lists every form on the
  site, grouped as the Forms manager groups them, with its page, its path and
  the email its visitor receives. Assign from the dropdown on the row, or tick
  forms inside a reply's own editor. A form's own page in `/admin/forms` shows
  the same answer at the top.
- **What is assignable** — lead forms. The newsletter signup and the valuation
  report gate are listed but fixed: their emails carry a confirmation link and
  a one-time code, so they are edited as themselves, and the row says so and
  links there.
- **Scope** — a reply may use the lead tokens plus `{{form_name}}` and
  `{{form_surface}}` (`FORM_REPLY_TOKENS`), so one reply can serve several
  forms and still name the one that was filled in.
- **Which form a lead came from** is recorded on `enquiries.form_key`, so the
  auto-reply cron sends the same reply the inline send would have chosen.

### Adding a form reply

Nothing to write in code: **New reply** in the Form replies tab creates a
draft carrying the acknowledgement's wording, and ticking a form assigns it.
A reply sends only while it is published and untrashed — an assigned draft
sends the acknowledgement, and says so on both screens.

### Where an email is used

`lib/content-assets/usage.ts` answers "who sends this?" for every email in the
gallery: the form half is **derived from the registry**, so a form added in
code appears without anyone remembering to, and a form pointed at a reply of
its own drops off the acknowledgement's list. The rest — a cron, an admin
button, a tool's second step — is stated per email, because nothing in the
codebase enumerates those. A test walks every route named there and fails if
one does not exist.

## How resolution works

```
a lead form was submitted?
  ├─ yes → a PUBLISHED reply assigned to that form?  → send it
  └─ then, either way:
     published row for this system_key?
       ├─ yes → render its tokens, wrap in the brand shell, send that
       └─ no  → does the email fall back to another? (mortgage → enquiry)
                  ├─ yes → same question for that email
                  └─ no  → send the built-in template, in the brand shell
```

The three reads — the reply, the override and the design — go out together, so
an assignment costs a lead no extra round trip.

"No" also covers: the row is a draft, the row is missing, the read failed,
`SUPABASE_SERVICE_ROLE_KEY` is unset, the row rendered to an empty subject or
body, or the row is **missing a required token** (below). **A system email
never fails to send because someone was editing it.**

That is the answer to the concern migration 0061 raised when it kept
transactional copy in code — "a half-saved edit would break a flow silently".
A half-saved edit here is a draft, and a draft sends nothing.

Every seeded row is a draft (migrations 0117 and 0127), so applying them
changed not one sent email. `lib/content-assets/system-emails.test.ts` pins
that: with nothing published, every send function returns the built-in
template byte for byte.

### The mortgage acknowledgement

The one email with no built-in of its own. Until someone publishes it,
`createEnquiry` (and the auto-reply cron) send a `source = 'mortgage'` lead the
enquiry acknowledgement — its published version if there is one, the built-in
otherwise — which is exactly what mortgage leads received before it existed.

### Guards in the database

In `supabase/migrations/0117` and `0127`, so a direct PostgREST call cannot
route around them:

- the system rows **cannot be deleted or trashed** — a trigger refuses;
- their `slug`, `kind` and `system_key` **cannot change**;
- a system row **must have a subject**, and `system_key` is one of the
  seventeen known values;
- `body_format = 'html'` only on system rows — outreach stays plain text.

### Reading past RLS

`content_assets` grants SELECT to staff only. Most system emails are triggered
by an anonymous visitor or a cron with no session, so the resolver in
`lib/content-assets/system-resolve.ts` uses the service-role client. That
exposes nothing new — the row is copy about to be emailed to the person who
triggered it.

There is no cache. One indexed single-row read per outbound email (plus one for
the design) is cheap, and a stale cache would mean publishing a correction and
watching the old wording keep sending.

Both reads are **bounded at 2.5 s** (`READ_DEADLINE_MS`). They sit in front of
a visitor's form submission and the service-role client has no timeout of its
own, so a database that stops answering would otherwise hold the request open.
Past the deadline the query is aborted and the built-in email sends in the
default design.

## Previews are the email

The gallery thumbnails, the editor's preview and the design page all render
through the **same bindings the send paths call**
(`lib/content-assets/system-emails.ts`). Each binding holds three things:

- `context` — the send path's arguments → token values;
- `builtin` — the code template;
- `sample` — a realistic set of arguments for the preview.

So a preview is not a mock-up: it is the email, addressed to a made-up lead.
It renders in a sandboxed iframe (`srcDoc`, no scripts) so the email's own
document styles apply, not the admin's. The editor shows four views — your
edits, what is sending now, the built-in (when yours is live) and the
plain-text part — at desktop or phone width, under an inbox header with the
real From and Reply-To (`emailSender()` in `lib/email.ts`).

**Send me a test** mails the version on screen to the signed-in staff member,
subject prefixed `[Test]`.

## The rich-text editor

`app/[locale]/(admin)/admin/content-assets/emails/_body-editor.tsx` — Tiptap,
like the blog, with a deliberately smaller extension list: bold, italic,
underline, two heading levels, lists, quotes, links, a divider, and two
email-only blocks:

- **Button** (`lib/tiptap/email-button.ts`) — stored as
  `<a data-email-button href>`; rendered as a filled button in the brand colour.
- **Image** (`lib/tiptap/email-image.ts`) — a plain block `<img>` from the media
  library, stored with `data-media-key` so it survives the Supabase project
  changing at handover.

**Insert field** adds tokens. Links and buttons can point at a url token
(`{{confirm_url}}`) or an absolute address.

### Rendering (`lib/content-assets/email-html.ts`)

1. **Save** — `sanitizeEmailBody` allowlists exactly what the editor produces.
   Images only from the project's media bucket (a hotlinked image is a tracking
   pixel nobody chose). This list and the editor's extensions must move
   together.
2. **Send, HTML** — re-sanitised, then every tag gets **inline** styles
   (Gmail and most of Outlook discard `<style>`). Tokens are substituted after
   sanitising and every value is escaped. Link targets are re-checked after
   substitution: relative paths become absolute, anything but
   http(s)/mailto/tel is dropped.
3. **Send, text** — the same message flattened: links keep their address,
   buttons become `Label: address`, lists get bullets or numbers.

## Tokens

`{{token}}` placeholders from the closed vocabulary in
`lib/content-assets/tokens.ts`. Three kinds:

| Kind | Example | Renders as |
|---|---|---|
| `text` | `{{lead_first_name}}` | words |
| `url` | `{{confirm_url}}` | an address — offered as a link or button target |
| `block` | `{{valuation_range_panel}}`, `{{form_answers}}` | a pre-built panel, the same code the built-in email uses |

Rules:

1. **Unknown tokens are a save-time error.** A typo'd `{{propery_ref}}` never
   reaches a client. The editor strikes them through as you type.
2. **Tokens are scoped.** Each system email declares exactly the tokens its own
   send path fills (`SYSTEM_ASSETS[key].tokens`); outreach gets the shared lead
   tokens. What you can insert is what you can save, by construction.
3. **Some tokens are required.** A confirmation without `{{confirm_url}}`, a
   welcome without `{{unsubscribe_url}}`, a code email without
   `{{verification_code}}`, an invitation or reset without `{{password_url}}`
   — these cannot be published, and a published row missing one is ignored at
   send time.
4. **A block token goes on its own line.** Written inside a sentence it renders
   its plain-text form instead.
5. **Optional lines vanish.** A few tokens fall back to nothing
   (`{{property_line}}`, `{{advisor_notes}}`, panels). A paragraph, quote or
   list item left empty after substitution is dropped from the email — that is
   how "For BAZ-AD-04891 · 3-bed" disappears from an enquiry that named no
   property. Every other token falls back to neutral wording
   (`{{lead_first_name}}` → "there").

## Starting wording

`lib/content-assets/system-defaults.ts` — each built-in email translated into
tokens and rich text. Migration 0127 seeds it into the draft rows, and the
editor's **Start from Bazar's wording** restores it. `system.test.ts` fails if
the migration and the file drift.

The four 0117 rows were plain text; 0127 moved them to rich text only where
they were still exactly as seeded (matched by hash). A plain-text row still
renders — `body_format` says which it is.

## Email design

`site_settings.email_branding` (jsonb, migration 0127), schema and defaults in
`lib/content-assets/email-brand.ts`:

- header: the wordmark (text + tagline) or a logo from the media library, with
  width, alt text and alignment. "Use the website's logo" copies the site
  logo; an SVG logo is warned about, because Gmail and Outlook don't render it;
- colours: button, button text (with a contrast warning under 4.5:1), links,
  text, muted text, background;
- footer: company lines, link label and address.

It applies to **every** email, built-in or rewritten — the built-in templates
take the brand as their last argument. `{}` resolves to the design the emails
had before the page existed, value for value. The column holds only overrides;
each key is validated on its own when read, so one bad colour costs that
colour, never the email.

Writing it is admin-only: `site_settings` RLS lets only an admin write. It is
not granted to anon — nothing public reads it (see the comment in 0127).

## Adding an email

Three places, one commit — the send path has to learn to read it at the same
time the key exists:

1. a migration: seed the row (as a draft) and widen the
   `content_assets_system_key_known` check constraint;
2. `SYSTEM_ASSETS` in `lib/content-assets/system.ts` (label, audience, trigger,
   tokens, required) and its starting wording in `system-defaults.ts`;
3. a binding in `lib/content-assets/system-emails.ts` — context, built-in,
   sample — and the send site awaits its send function.

The tests check that every key has a registry entry, a seeded row, starting
wording that uses only its own tokens, and a binding that renders with no
braces left over.

## History

- **0061/0062** — the outreach library.
- **0117** — Settings → Templates, which wrote `{subject, body}` overrides into
  `site_settings.email_templates` that nothing read, was replaced by four
  `system_key` rows. The column is left in place, unread.
- **0128** — form replies: every public form mapped to the email its visitor
  receives, assignable from the CMS; `content_assets.role`; `forms.reply_asset_id`;
  `enquiries.form_key`; and "where is this used" on every email in the gallery.
- **0127** — all eighteen emails catalogued; thirteen more rewritable; rich
  text; email design; the valuation code and report-requested emails moved out
  of inline HTML in `app/api/valuation-lead/route.ts` into templates (they had
  no Bazar header); the viewing confirmation's calendar invite, built and then
  discarded, is now actually attached.
