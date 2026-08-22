# Content Assets

Everything Bazar sends to a person, written in one place: `/admin/content-assets`.

Two tabs, because there are two kinds of outbound message and they behave
differently.

| | **Outreach** | **System emails** |
|---|---|---|
| Who sends it | an advisor, by hand | the site, with nobody watching |
| Where it is used | the enquiry composer | the four transactional send paths |
| Channels | email + WhatsApp | email only |
| Body is | the **middle** of a message — a greeting and the advisor's signature are added by `staffReplyTemplate` | the **whole** message, greeting and sign-off included; only the Bazar header and footer are added |
| Draft means | it does not appear in the composer | Bazar's built-in wording sends |
| Published means | advisors can pick it | this wording sends instead of the built-in |
| Can be deleted | yes, via trash | **no** |
| Rows | as many as you like | exactly four |

## The four system emails

| Key | Sends when | Built-in template |
|---|---|---|
| `enquiry_auto_reply` | any public enquiry form is submitted, plus the auto-reply cron sweep | `enquiryReceivedTemplate` |
| `valuation_request_ack` | an owner completes `/tools/valuation` | `valuationReceivedTemplate` |
| `viewing_confirmation` | an advisor books a viewing from an enquiry | `viewingConfirmationTemplate` |
| `newsletter_welcome` | a subscriber clicks the confirmation link | `newsletterWelcomeTemplate` |

All four built-ins live in `lib/email-templates.ts` (the newsletter one in
`lib/newsletter-templates.ts`).

## How resolution works

```
published row for this system_key?
  ├─ yes → render its tokens, wrap in the Bazar shell, send that
  └─ no  → send the built-in template
```

"No" also covers: the row is a draft, the row is missing, the read failed,
`SUPABASE_SERVICE_ROLE_KEY` is unset, or the row rendered to an empty subject
or body. **A system email never fails to send because someone was editing it.**

That is the answer to the concern migration 0061 raised when it kept
transactional copy in code — "a half-saved edit would break a flow silently".
A half-saved edit here is a draft, and a draft sends nothing.

Three more guards, in the database rather than the app, so a direct PostgREST
call cannot route around them (`supabase/migrations/0117`):

- the four rows **cannot be deleted or trashed** — a trigger refuses;
- their `slug`, `kind` and `system_key` **cannot change** — the send path finds
  them by key;
- a system row **must have a subject**, and `system_key` can only ever be one
  of the four known values.

`system_key` is assigned by migration. Nothing in the editor can set one, and
an ordinary asset cannot be promoted into a system email.

### Reading past RLS

`content_assets` grants SELECT to staff only. Three of the four system emails
are triggered by an anonymous visitor and one by a cron with no session, so
the resolver in `lib/content-assets/system-resolve.ts` uses the service-role
client. That exposes nothing new — the row is copy about to be emailed to the
person who triggered it — and it is the only way a published override reaches
a public send path.

There is no cache. One indexed single-row read per outbound email is cheap,
and a stale cache would mean publishing a correction and watching the old
wording keep sending.

## Tokens

`{{token}}` placeholders, from a closed vocabulary in
`lib/content-assets/tokens.ts`. Two rules:

1. **Unknown tokens are a save-time error.** A typo'd `{{propery_ref}}` never
   reaches a client.
2. **Tokens are scoped.** Each system email declares exactly the tokens its
   own send path fills (`SYSTEM_ASSETS[key].tokens`); everything else gets the
   shared lead tokens. `{{viewing_time}}` is spelled correctly and still wrong
   in a hand-written follow-up, because nothing on that path fills it — so the
   editor will not offer it there, and will not save it either. What you can
   insert is what you can save, by construction.

A known token with no value at send time falls back to neutral wording rather
than leaving a hole (`{{lead_first_name}}` → "there"). Fallbacks are a safety
net, not a feature: the enquiry composer warns the advisor which ones will
fire, before sending.

### Adding a fifth system email

Three places, one commit — the send path has to learn to read it at the same
time the key exists:

1. a migration: seed the row and widen the `content_assets_system_key_known`
   check constraint;
2. `SYSTEM_ASSETS` in `lib/content-assets/system.ts` — slug, label, trigger
   line, and the exact token list;
3. a binding in `lib/content-assets/system-emails.ts` pairing the token
   context with the built-in template, then the send site awaits it.

## History

Transactional copy used to have a second, non-functioning home: Settings →
Templates wrote `{subject, body}` overrides into `site_settings.email_templates`
and nothing ever read the column — every email sent from the code literals
regardless. Migration 0117 replaced it with the `system_key` rows and the route
was removed. The column is left in place, unread; production held `{}`, so no
override was lost.
