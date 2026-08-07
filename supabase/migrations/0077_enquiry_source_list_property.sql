-- 0077_enquiry_source_list_property.sql
-- Add 'list_property' to enquiry_source.
--
-- /services/sell is rebuilt as an owner-side lead capture: a two-step
-- qualification form (property → contact) that routes the owner to the advisor
-- covering their community. Those leads are a different animal from the generic
-- contact form — they carry a property brief, an intent (sell vs rent out) and a
-- callback window, and the desk works them as listing opportunities rather than
-- buyer briefs. Filing them under 'contact_page' would bury that in the queue.
--
-- Everything else the lead needs already exists on `enquiries`: `timeline` takes
-- the urgency answer, `assigned_agent_id` takes the matched advisor, and the
-- qualification payload rides in `inferred_constraints` jsonb.
--
-- Adding an enum value is backward-compatible. Nothing switches exhaustively
-- over enquiry_source in the app — the admin filters render whatever they are
-- given — but lib/schemas/enquiry.ts keeps its own ENQUIRY_SOURCES list, which
-- is updated alongside this.

alter type public.enquiry_source add value if not exists 'list_property';
