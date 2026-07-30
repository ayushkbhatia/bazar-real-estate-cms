-- 0066_enquiry_source_brochure.sql
-- Add 'brochure' to enquiry_source.
--
-- The brochure gate on a development page collected an email address and threw
-- it away — a Sprint 5a stub that toasted "Sprint 10 wires the real send" and
-- never sent or stored anything. It now creates a real enquiry, which needs a
-- source of its own: filing brochure requests under 'property_page' would make
-- them indistinguishable from someone enquiring about a listing, and the whole
-- point is knowing which development page the lead came from.
--
-- `enquiries.development_id` already exists (0001), so the provenance has
-- somewhere to live without further schema changes.
--
-- Adding an enum value is backward-compatible. Nothing switches exhaustively
-- over enquiry_source in the app — the admin filters render whatever they are
-- given — but lib/schemas/enquiry.ts keeps its own ENQUIRY_SOURCES list, which
-- is updated alongside this.

alter type public.enquiry_source add value if not exists 'brochure';
