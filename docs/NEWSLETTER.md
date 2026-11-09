# Newsletter

The site's own newsletter: a subscriber list, a composer, and a sender, all in
`/admin/newsletter`, delivered through Resend. Mailchimp is not used
([ADR-0009](decisions/ADR-0009-own-newsletter-sender-over-mailchimp.md)).

## What an editor does

1. **Newsletter → New newsletter.** Pick a starting point:
   - **Built from blocks** — a template laid out block by block (below):
     **Project launch** (from the project picked in the same dialog),
     **Featured listings**, **Market update**, **Event invitation**,
     **Announcement**, or **Build your own**.
   - **Your templates** — any the team saved.
   - **Rich text** — **Blank**, or a layout already filled with what is
     newest on the site, in both editions: **Monthly digest** (a featured
     project, the four newest listings, the latest three articles), **New
     listings**, **Project launches**, **From Insights**.

   A draft opens in the composer.
2. **Write** — subject, preview line and body in the same rich-text editor the
   Content assets emails use (headings, lists, links, buttons, images, fields),
   plus **Feature** for the site's own listings, projects, articles and area
   guides (below). Links, buttons and images can point at any published page
   by searching for it ("Find a page on the site"); an image can be a link.
   An optional **Arabic edition** (subject + body); Arabic subscribers get it,
   and get the English when it's blank. **Translate from English** drafts it
   by machine, **Copy the English** copies the layout to translate by hand.
3. **Audience** — every confirmed subscriber, English only, Arabic only, or
   none; plus any **custom lists** (below). The count is exact: each address
   once, suppressed addresses left out.
4. **Review** — the real email in a desktop / phone frame, English and Arabic,
   and **Send me a test** to the signed-in address.
5. **Send** — now, or scheduled for a date and time. Sending asks for the
   recipient count to be confirmed.
6. The campaign's page then shows progress: queued / sent / failed / skipped.

**Subscribers** lists everyone who signed up — status, language, source,
dates — filterable and searchable, with **Re-send confirmation** for anyone
still pending (per row, or every pending address at once) and **Unsubscribe**
for anyone who asks by other means.

## Block-built newsletters

A newsletter can be built from blocks instead of written as rich text
(`newsletter_campaigns.format = 'blocks'`, the document in `design`,
migration 0175). It is how a launch mailer is made: a full-width hero
photograph with the logo and a headline over it, serif headings on cream
bands, photo bands between sections, a row of features, tags for the unit
types, a two-column amenities list, an "at a glance" table, a closing band
with two buttons, social icons and a contact footer.

- **The library** (`lib/newsletter/blocks/catalogue.ts`, presets in
  `presets.ts`): 23 kinds of block — hero with background image, logo bar,
  heading, paragraph, heading + text + button, quote, image, image beside
  text, image row, feature columns, cards, figures, tags, list, at a glance,
  advisor card, button, call-to-action band, live listings/projects/articles,
  social links, contact and footer, divider, space — and 55 ready-made
  presets in **Add a block**, searchable and grouped.
- **Each block** has its words, links, pictures (from the media library or
  uploaded on the spot) and colours (Bazar's swatches or any hex), plus page
  colours and typefaces. Blocks are moved, duplicated, inserted below and
  removed in the composer; the preview beside it is the real email.
- **Arabic** sits beside the English in each block (`<key>_ar`). The Arabic
  tab shows only the words, each with its English. Writing an Arabic subject
  turns the Arabic edition on; from then every text needs its Arabic, and the
  composer names the ones missing. **Translate from English** (one field at a
  time through lib/i18n/mt) and **Copy the English** fill them. The Arabic
  email is drawn right to left, in fonts the reader has, never letter-spaced,
  and its site links go to `/ar` pages.
- **Rendering** (`render.ts`): 600px email-safe tables and inline styles; one
  `<style>` that stacks columns on a phone. The hero's photo is a CSS
  background with the overlay colour as fallback (Outlook desktop shows the
  colour). Every link goes through one check — https, http, mailto:, tel:, a
  page on the site, or a `{{token}}`; anything else draws as text and the
  composer blocks the send. The unsubscribe footer is always the last row.
- **Logos and icons** are PNGs in `public/email/` (email clients don't show
  SVG), drawn by `scripts/email/social-icons.mjs`.
- **Built-in templates** (`templates.ts`, filled by `template-data.ts`) are
  code, like the rich-text starters; what fills them is live. **Project
  launch** reads the chosen project: its hero, name and tagline, its feature
  blocks (titles, copy and photos, with their Arabic), bedrooms, handover,
  developer and area. Every template's footer reads the footer CMS
  (/admin/footer): socials, phone, WhatsApp, email, address, licence line.
- **Saved templates** (`newsletter_templates`): **Save as template** in the
  composer keeps every block, both languages, the subject and preview line.
  **Newsletter → Templates** shows each as its email, to use, rename or
  delete.

## Custom lists

**Newsletter → Lists** (`/admin/newsletter/lists`, migration 0176): lists of
people to send a campaign to besides — or instead of — the subscribers, such
as an event's guests. Admin and marketing only; the contacts are personal
data.

- **Upload a CSV** with an email column and a name column (or first + last
  name), optionally a language column (`ar`/`Arabic` → Arabic edition).
  Comma, semicolon or tab; a header row or none (`lib/newsletter/lists.ts`).
  The dialog previews what it read and what it left out, and asks the
  editor to confirm everyone agreed to hear from Bazar. Up to 20,000 a file.
- **Add someone** by hand, **Download CSV**, **Unsubscribe** or **Remove** a
  row, rename or delete the list.
- **In a campaign**, tick lists in the Audience step. Someone on a list and
  subscribed, or on two lists, gets one copy. List contacts get a footer
  that doesn't claim they signed up, and their own unsubscribe link and
  one-click header (the same `/newsletter/unsubscribe/[token]` page and
  endpoint read either kind of token).

### Suppression

`newsletter_suppressions` holds the SHA-256 of every address that
unsubscribed, hard-bounced or complained — from the subscriber list or any
list — and never the address. Triggers keep it: unsubscribing anywhere
suppresses the address everywhere, ends its subscription and marks its other
list rows; confirming a subscription again (an explicit opt-in) lifts it.
The campaign snapshot leaves suppressed addresses out, the sender checks
again per batch, an import skips them, and adding one by hand is refused.
Resend's webhook marks list contacts bounced or unsubscribed like
subscribers.

### Data-subject requests

`/admin/dsr`'s export lists the subject's list rows and whether the address
is suppressed; erasure (`anonymise_by_email`, 0176) deletes their list rows
with the subscription. The suppression fingerprint stays: it is what keeps
the objection honoured, and it can't be turned back into an address.

## Featured listings, projects, articles and areas

The composer's **Feature** button places up to six records of one kind —
listings, projects, articles or area guides — as cards, in one of three
layouts: **Cards** (one full-width card each: photo, name, facts, price,
link), **Grid** (two to a row) or **List** (a line each with a thumbnail).
Each block can be re-picked, reordered, restyled or dragged in the editor.

**The block stores the records, not their words.** It is an empty
`<div data-email-feature="property" data-ids="…" data-layout="grid">` in the
body (`lib/content-assets/email-feature.ts`), like an article's internal
links (docs/INTERNAL_LINKS.md). The cards are drawn when the email is
rendered — preview, test and every send — from the live records:

- **In the reader's language.** The Arabic edition's cards carry the Arabic
  names, the site's Arabic words for "For sale", bedrooms, handover, and
  prices in the site's own currency words (Units & currency settings), right
  to left, linking to the `/ar` pages. Nobody translates a card; copying or
  translating the English carries the block over as it is.
- **Today's facts.** A repriced listing goes out at its new price.
- **Nothing dead.** A record unpublished by send time is left out (a block
  with none left draws nothing). The composer warns while writing — the
  block shows *Not live*, and a notice under the editor names it.

How: `lib/newsletter/features.ts` looks the records up — projects, listings
and areas through the article internal-link resolver (one query per kind, the
public client, the site's publication filters), articles with one more query
— and `lib/newsletter/feature-render.ts` draws email-safe tables with inline
styles. The sender looks them up once per campaign and edition per batch,
never per recipient. Card photos go through the site's own image optimizer in
production (`/_next/image`, the variants the public pages already use) rather
than the ~1.4 MB originals; elsewhere the original is used.

The sanitiser keeps a featured block only where asked (`{ features: true }` —
the newsletter's save and render); in every system email it is stripped. A
sent campaign's report draws its cards from the records as they are now.

## Starting points and the Arabic edition

The starter layouts are code (`lib/newsletter/starters.ts`) — templates, like
a page's sections; what fills them is the live catalogue, picked as the draft
is made. Each leaves one bracketed line — "[Write a line or two introducing
this issue.]" — that blocks sending until it is replaced, in both editions.

**Translate from English** (`newsletter/_translate.ts`) is the property
editor's machine-translation pipeline (lib/i18n/mt): prices, names and links
masked, the body split into blocks with its markup replaced by markers, every
block validated and left in English if rejected (the composer says how many).
It fills the composer without saving — a first draft to read (ADR-0008) —
and needs `ANTHROPIC_API_KEY`; without one the button is hidden and **Copy the
English** remains. Both point links to site pages at their `/ar` pages.

## Where people sign up

Two boxes, one form: the /insights hero and the box under every article
(`insights/[slug]/_components/article-newsletter.tsx`). Both take their
button, placeholder and confirmation from the `insights_newsletter` form
(/admin/forms) and their eyebrow, heading and blurb from the Insights master
page's `featured` section (/admin/pages/master/insights), so an edit there
words both, in English and Arabic. Their sign-ups are told apart by `source`:
`insights_header` and `insights_article`.

### Bot sign-ups

From August to November 2026 a bot signed up 26 addresses and had a
confirmation email sent to each: real people's work addresses, and Gmail
inboxes padded with dots (`c.o.v.o.yovu.z.u.49@gmail.com` is one person's
`covoyovuzu49`). None ever confirmed; all 26 were deleted on 3 Nov 2026.

`subscribeToNewsletter` now drops, without storing or emailing anything, a
sign-up that fills the signup box's hidden trap, arrives under two seconds
after the box was drawn, or uses a dot-padded Gmail address
(`isDotPaddedGmail` in `lib/forms/spam.ts`). The visitor sees the usual
"check your inbox" either way. One IP may also sign up at most 4 times an
hour and 8 times a day.

## Sender

Newsletters carry their own From and Reply-To, set at **Newsletter → Sender**
(`/admin/newsletter/settings`, `newsletter_settings`, migration 0174). Every
other email the site sends keeps the env's `RESEND_FROM_ADDRESS` /
`RESEND_REPLY_TO`; a blank field here falls back to those too.

- Seeded as **Marketing at Bazar Real Estate**
  `<marketing@bazarrealestate.com>`, replies to `marketing@bazarrealestate.ae`.
- The From must be on a domain Resend has verified: saving asks Resend
  (`resendSendingDomains()` in `lib/email.ts`) and refuses any other, because
  Resend refuses every message from an unverified domain. As of 3 Nov 2026 the
  verified domain is **bazarrealestate.com**; `bazarrealestate.ae` is not.
  To send from `marketing@bazarrealestate.ae`: add the domain in Resend, set
  the SPF/DKIM records it lists at the .ae registrar, wait for *Verified*,
  then change the address here — no deploy.
- The Reply-To can be any address; replies need no verification.
- The sender, "Send me a test" and the preview's inbox header all read
  `readNewsletterSender()` (`lib/newsletter/sender-read.ts`).

## Who may do what

| | admin | marketing | editor | others |
|---|---|---|---|---|
| View subscribers and campaigns | ✓ | ✓ | ✓ | — |
| Draft, edit, preview, send a test | ✓ | ✓ | ✓ | — |
| Send / schedule to the list | ✓ | ✓ | — | — |
| Re-send confirmation, unsubscribe someone | ✓ | ✓ | — | — |

Enforced twice: `requireRole` in every action, and RLS on the tables
(`current_staff_role()`).

## How sending works

- **Start.** `newsletter_start_campaign(id)` (SQL, migration 0162) snapshots
  the audience into `newsletter_deliveries` — one row per confirmed subscriber
  in the chosen language(s), unique per campaign — and marks the campaign
  `sending`. A scheduled campaign is started by the cron once its time comes.
- **Drain.** `drainNewsletterQueue()` claims up to 100 queued deliveries
  (`newsletter_claim_deliveries`, `FOR UPDATE SKIP LOCKED`, so two runs never
  take the same row), renders each recipient's email in their language, and
  sends them as one Resend batch with an idempotency key. The send action
  drains once straight away; `/api/cron/newsletter-send` (every minute) drains
  the rest, starts due schedules and closes finished campaigns.
- **Per recipient.** Each email carries that subscriber's own unsubscribe link
  in the footer and as `List-Unsubscribe` / `List-Unsubscribe-Post` headers
  (one-click, RFC 8058) — mailbox providers require both for bulk mail.
- **Safety.** A subscriber who unsubscribed after the snapshot is skipped at
  send time. A failed batch is retried up to three times, then marked failed.
  Outside production, delivery is a dry run (`EMAIL_DRY_RUN`), and every
  delivery is marked `skipped` rather than `sent`.
- **Done.** When nothing is left queued or in flight, the campaign is `sent`
  with its totals.

## Delivery events

"Delivered to Resend" only says Resend accepted a message. What happened next
comes back from Resend's webhook, `POST /api/webhooks/resend`, subscribed to
`email.delivered`, `email.bounced` and `email.complained` for every email the
site sends:

- The route checks the Svix signature (`svix-id`, `svix-timestamp`,
  `svix-signature`, five minutes' tolerance) against `RESEND_WEBHOOK_SECRET`.
  Without the secret it refuses everything.
- The webhook belongs to the Resend **account**, and the account also sends
  for other sites (Indus Hydraulics, including its newsletter on
  news.indushydraulics.com since 2026-11-09), so their events arrive here
  too. An event whose From domain is not Bazar's — `SENDER_DOMAINS` in
  `lib/newsletter/events.ts` (bazarrealestate.com, bazarrealestate.ae, any
  subdomain) plus the domain of `RESEND_FROM_ADDRESS` — is answered
  `200 { ignored: "other-sender" }` and writes nothing. An event with no From
  is treated as ours. Moving the newsletter's From to a new domain means
  adding it to that list.
- Each event goes to `newsletter_record_email_event()` (0164, service role
  only). It stamps `delivered_at` / `bounced_at` + `bounce_type` /
  `complained_at` on the newsletter delivery whose `resend_id` matches, which
  is where the campaign report's **Reached the inbox / Bounced / Marked as
  spam** come from.
- A **permanent** bounce on any email to a subscriber's address (the
  confirmation email included) marks them `bounced`, so no campaign mails
  them again. Transient bounces change nothing.
- A **spam complaint** about a newsletter unsubscribes its reader.
- Only `pending` and `confirmed` subscribers change. Every write is a
  coalesce or a guarded status change, so Resend's retries are harmless. A
  bounced address that signs up again goes back to `pending`.

Setting it up (done once per Resend account): create the webhook for the
production URL with those three events — the Resend dashboard, or
`resend.webhooks.create` — then set its `whsec_…` signing secret as
`RESEND_WEBHOOK_SECRET` in Vercel production and redeploy.

## Unsubscribing

Every subscriber has a permanent `unsubscribe_token` (0162). It is what the
footer link, the header and the welcome email use. The old flow used the
confirmation token, which confirming cleared — so every confirmed
subscriber's unsubscribe link was dead. Legacy links that still carry a
confirmation token keep working.

`POST /api/newsletter/unsubscribe?token=…` is the one-click endpoint the
`List-Unsubscribe-Post` header points mail clients at;
`/newsletter/unsubscribe/[token]` is the page a person lands on. The page
only reads: it shows the address and an **Unsubscribe** button, and the
button does the unsubscribing. Mail scanners and link previewers open every
URL in an email, so a page that unsubscribed as it rendered removed people
who never asked to go.

## Data and privacy

- `newsletter_deliveries` stores no address — only the subscriber id — and
  cascades on the subscriber's deletion, so a data-subject erasure (which
  deletes the subscriber row) removes their delivery history too.
- No PII in logs: addresses are masked as everywhere else in `lib/email.ts`.

## Files

| | |
|---|---|
| `supabase/migrations/0162_newsletter_campaigns.sql` | token column, campaigns, deliveries, the two SQL functions, RLS |
| `supabase/migrations/0164_newsletter_delivery_events.sql` | delivery event columns, `newsletter_record_email_event()` |
| `lib/newsletter/events.ts` | webhook signature check and event parsing |
| `app/api/webhooks/resend/` | the delivery-event webhook |
| `lib/newsletter/campaign.ts` | types, schema, audience, render (shared by preview, test and send) |
| `lib/content-assets/email-feature.ts` | the featured block's vocabulary: kinds, layouts, attributes, parsing |
| `lib/tiptap/email-feature.ts` | the editor node; `email-image.ts` carries an image's link |
| `lib/newsletter/features.ts` | looking featured records up, per language (server) |
| `lib/newsletter/feature-render.ts` | drawing them as email cards, and their Arabic words |
| `lib/newsletter/starters.ts` | the starter layouts |
| `admin/content-assets/emails/_feature-*.tsx` | the Feature picker and the block's editor view |
| `admin/newsletter/_feature-targets.ts` | what the picker offers (published records + articles) |
| `admin/newsletter/_translate.ts` | Translate from English |
| `lib/newsletter/send.ts` | start, drain, finish — the sender |
| `lib/newsletter/sender.ts`, `sender-read.ts` | the newsletter's From / Reply-To (0174) |
| `supabase/migrations/0175_newsletter_block_designs.sql` | `format`, `design`, `newsletter_templates` |
| `supabase/migrations/0176_newsletter_lists.sql` | lists, contacts, suppressions, deliveries to contacts, erasure |
| `lib/newsletter/blocks/` | the block library, presets, document, renderer, templates |
| `lib/newsletter/lists.ts` | reading a CSV into contacts |
| `admin/newsletter/[id]/_designer.tsx` | the block designer |
| `admin/newsletter/templates/`, `lists/`, `settings/` | saved templates, custom lists, the sender |
| `lib/email.ts` | `headers` on a send; `sendEmailBatch` |
| `app/api/cron/newsletter-send/` | the minute cron |
| `app/api/newsletter/unsubscribe/` | one-click unsubscribe |
| `app/[locale]/(admin)/admin/newsletter/` | Campaigns, the composer, Subscribers |

## Follow-ups

- **Card prices at send time, not frozen.** Cards are drawn per batch, so a
  long send (100 a minute) could straddle a price change. A snapshot of the
  resolved records when sending starts would freeze them; not worth a
  migration at today's list size.

- **Opens and clicks.** Resend can report both (`email.opened`,
  `email.clicked`), but open tracking adds a pixel and click tracking rewrites
  every link through Resend's domain. Not switched on; a decision for the
  client, and the privacy policy would need to say so.
