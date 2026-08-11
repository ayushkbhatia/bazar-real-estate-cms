-- 0088_enquiry_source_service_leads.sql
-- Add 'property_management' and 'property_consultation' to enquiry_source.
--
-- /services/manage gains a lead form and /services/consultation is a new page
-- with one. Both leads carry a qualification tail the generic contact intake
-- has no room for — the management lead names a community and a property type,
-- the consultation lead names what the person is trying to do — and the desk
-- works them as separate queues. Filing both under 'contact_page' would bury
-- that distinction the moment volume picks up.
--
-- Everything else the leads need already exists on `enquiries`:
-- `assigned_agent_id` takes the routed advisor and the qualification payload
-- rides in `inferred_constraints` jsonb.
--
-- Adding an enum value is backward-compatible. Nothing switches exhaustively
-- over enquiry_source in the app — the admin filters render whatever they are
-- given — but lib/schemas/enquiry.ts keeps its own ENQUIRY_SOURCES list, which
-- is updated alongside this.

alter type public.enquiry_source add value if not exists 'property_management';
alter type public.enquiry_source add value if not exists 'property_consultation';
