-- 0166 · A Salesforce listing that has become the website's own.
--
-- Until now the listing sync owned a Salesforce listing's facts for as long as
-- the CRM published it: title, price, rooms, location, permit, amenities and
-- photos were put back from Salesforce on every fifteen-minute run, and the
-- property editor refused to change them. The client wants the reverse (21 Oct
-- 2026): Salesforce supplies the first draft, and from then on the listing is
-- edited and published on the website like any other.
--
-- So the sync now creates a listing's property row once — a draft, with its
-- photos — and never writes that row, its photos or its status again. A mirror
-- row whose listing has reached that point says so with this state. Holds,
-- approval and hiding only mean anything before it: they decide whether a draft
-- is created at all.
--
-- Additive. Nothing deployed before this migration writes the value, so it can
-- be applied ahead of the code.

alter type public.salesforce_listing_state add value if not exists 'on_website';
