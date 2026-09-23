-- 0133 · Retire the "Viewing scheduled" pipeline stage.
--
-- 0132 removed viewing bookings; this removes the Kanban column that named
-- them. With no way to book a viewing, a stage recording that one had been
-- booked is a lane leads can only be dragged into by hand and never leave for
-- a reason the system understands.
--
-- ── Why this is a type rewrite ───────────────────────────────────────────
-- PostgreSQL can add a value to an enum but cannot drop one, so the type is
-- rebuilt without it and the column re-cast through text. That is the whole
-- recipe; it is only safe because of how little depends on it:
--
--   · one column — enquiries.status, NOT NULL, default 'new'
--   · one index  — enquiries_status_idx, rebuilt automatically by the cast
--   · no view, no policy, no function mentions the value (checked in prod)
--
-- ── The backfill is not decoration ───────────────────────────────────────
-- Production holds zero rows on this stage today, so the UPDATE below is a
-- no-op there. It stays because the cast fails outright on any row that still
-- carries the value, and this migration has to survive being replayed against
-- a restored backup or a branch database taken before 0132.
--
-- `qualified` is the conservative landing: a lead far enough along to have a
-- viewing arranged is at least qualified, and moving it back one stage
-- understates progress where moving it to `offer` would invent it.

update public.enquiries
   set status = 'qualified'
 where status = 'viewing_scheduled';

alter type public.enquiry_status rename to enquiry_status_old;

create type public.enquiry_status as enum (
  'new',
  'qualified',
  'offer',
  'closed_won',
  'closed_lost'
);

-- The default has to go before the cast and come back after: it is an
-- expression of the old type, and the column cannot be re-typed underneath it.
alter table public.enquiries
  alter column status drop default;

alter table public.enquiries
  alter column status type public.enquiry_status
    using status::text::public.enquiry_status;

alter table public.enquiries
  alter column status set default 'new'::public.enquiry_status;

drop type public.enquiry_status_old;

comment on column public.enquiries.status is
  'Sales pipeline stage. "viewing_scheduled" was removed in 0133 along with viewing bookings; leads on it were moved to "qualified".';
