-- 0062_content_assets_seed.sql
-- Starter outreach library for /admin/content-assets.
--
-- Seven assets covering the touches an advisor actually repeats: the first
-- reply to a new enquiry, a viewing invite, a documents request, a revival
-- nudge, and the WhatsApp equivalents. Everything here is editable in the
-- admin — this is a starting point, not a fixed set.
--
-- On body copy: EMAIL bodies are the MIDDLE of the message only. The sending
-- path (staffReplyTemplate) already wraps the body in the Bazar shell with
-- "Hello <name>," above and the advisor signature below, so a body that opens
-- with its own greeting would render two. WhatsApp has no wrapper, so those
-- bodies do carry their own greeting.
--
-- Tokens are resolved by lib/content-assets/render.ts. Unknown tokens are a
-- save-time error in the editor, so anything added here must exist there:
--   {{lead_first_name}} {{lead_name}} {{property_reference}}
--   {{property_title}}  {{advisor_name}} {{advisor_phone}} {{site_url}}
--
-- Idempotent: keyed on slug, and existing rows are left alone rather than
-- overwritten — re-running must not silently revert someone's edits.

insert into public.content_assets
  (slug, kind, name, category, subject, body, notes, follow_up_after_days, status, position)
values
  (
    'enquiry-first-response',
    'email',
    'First response — new enquiry',
    'enquiry',
    'Re: {{property_reference}}',
    E'Thank you for your enquiry about {{property_title}} ({{property_reference}}).\n\n'
    'I''d be glad to talk you through the unit, the current pricing and what is '
    'available on the same floor plate.\n\n'
    'Would a short call tomorrow suit, or would you prefer I send the full '
    'brochure and floor plans first?',
    'Send within two hours of the enquiry landing — the SLA banner on the enquiry turns amber after that. Ask one question only; a reply is the goal, not a pitch.',
    3,
    'published',
    0
  ),
  (
    'viewing-invite',
    'email',
    'Viewing invite',
    'enquiry',
    'Viewing — {{property_reference}}',
    E'I have viewing slots open for {{property_title}} this week.\n\n'
    'If either works, I''ll confirm access with the building and send the exact '
    'meeting point:\n\n'
    '  ·  Weekday, late afternoon\n'
    '  ·  Saturday morning\n\n'
    'If neither suits, tell me the days that do and I''ll work around them.',
    'Use once the lead has engaged at least once. Book it in the CMS the moment they pick a slot so the viewing reminder cron picks it up.',
    2,
    'published',
    1
  ),
  (
    'documents-request',
    'email',
    'Documents request',
    'enquiry',
    'Next steps — {{property_reference}}',
    E'To move forward on {{property_reference}} I''ll need a few documents from '
    'your side:\n\n'
    '  ·  Passport copy (and Emirates ID, if you hold one)\n'
    '  ·  Proof of funds or a mortgage pre-approval\n\n'
    'You can reply to this email with them attached. I''ll confirm receipt the '
    'same day and let you know what happens next.',
    'Only after intent is clear — asking for documents too early reads as pressure. Pairs with the deal-room KYC checklist.',
    null,
    'published',
    2
  ),
  (
    'revival-nudge',
    'email',
    'Revival nudge — gone quiet',
    'enquiry',
    'Still looking? — {{property_reference}}',
    E'I haven''t heard back on {{property_reference}}, so I wanted to check '
    'whether you''re still looking.\n\n'
    'If the timing has moved, that''s no problem at all — tell me roughly when '
    'and I''ll keep an eye out in the meantime. If your budget or the areas '
    'you''re considering have changed, I can send a fresh shortlist.',
    'Send once, around a week after the last unanswered message. If this one goes unanswered too, mark the enquiry closed_lost rather than sending a third.',
    null,
    'published',
    3
  ),
  (
    'whatsapp-first-touch',
    'whatsapp',
    'First touch — WhatsApp',
    'enquiry',
    null,
    E'Hello {{lead_first_name}}, this is {{advisor_name}} from Bazar Real Estate '
    '— following up on your enquiry about {{property_reference}}. '
    'Happy to answer anything, or send the floor plans across. '
    'When suits you for a quick call?',
    'The opener when a phone number is on file. Keep it to a few lines — long WhatsApp messages get skimmed. Send during business hours.',
    2,
    'published',
    4
  ),
  (
    'whatsapp-viewing-confirm',
    'whatsapp',
    'Viewing confirmation — WhatsApp',
    'enquiry',
    null,
    E'Confirmed, {{lead_first_name}} — viewing at {{property_title}}. '
    'I''ll meet you in the lobby and bring the floor plans. '
    'My number is {{advisor_phone}} if anything changes on the day.',
    'Send straight after booking the viewing in the CMS. The automated reminder still goes out separately; this one is the personal touch.',
    null,
    'published',
    5
  ),
  (
    'whatsapp-nudge',
    'whatsapp',
    'Gentle nudge — WhatsApp',
    'enquiry',
    null,
    E'Hello {{lead_first_name}}, just checking you saw my note about '
    '{{property_reference}}. No rush at all — happy to pick this up whenever '
    'the timing is right for you.',
    'One nudge only, a couple of days after the first touch. If it goes unanswered, move to email rather than sending a third WhatsApp.',
    null,
    'published',
    6
  )
on conflict (slug) do nothing;

-- Sequencing links, applied after the rows exist so ordering doesn't matter.
-- Only set where the follow-up slot is still empty, so an editor who has
-- rewired the sequence keeps their version.
update public.content_assets a
set next_asset_id = b.id
from public.content_assets b
where a.slug = 'enquiry-first-response' and b.slug = 'revival-nudge'
  and a.next_asset_id is null;

update public.content_assets a
set next_asset_id = b.id
from public.content_assets b
where a.slug = 'whatsapp-first-touch' and b.slug = 'whatsapp-nudge'
  and a.next_asset_id is null;

update public.content_assets a
set next_asset_id = b.id
from public.content_assets b
where a.slug = 'viewing-invite' and b.slug = 'documents-request'
  and a.next_asset_id is null;
