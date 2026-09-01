-- 0121 · Residential vs commercial, as a column of its own.
--
-- WHY THIS EXISTS
-- The catalogue had no way to say whether a listing is residential or
-- commercial. The closest thing was `mode = 'commercial'`, which sits on the
-- TRANSACTION axis beside buy / rent / off_plan — so a commercial unit for rent
-- had to pick one of the two facts to record, and the search surfaces offered
-- "Commercial" as a fourth alternative to Buy and Rent rather than as what it
-- is: a different kind of building, for sale or to let like any other.
--
-- `type` is not a substitute either. It mixes the two axes — apartment, villa
-- and townhouse beside office, retail and building — and `land` belongs to
-- neither, so deriving a segment from it would be a guess the CMS could not
-- correct.
--
-- So: one column, two values, editable per listing.

create type property_segment as enum ('residential', 'commercial');

-- Nullable first, backfilled, then constrained. Adding it NOT NULL DEFAULT in
-- one statement would work on a table this size, but it would also stamp
-- 'residential' onto the commercial rows below before anything could look at
-- them.
alter table public.properties
  add column segment property_segment;

/*
 * The backfill. Everything is residential except what already said otherwise
 * on one of the two axes that existed:
 *
 *   · `mode = 'commercial'` — the operator's explicit statement, on the only
 *     control the CMS gave them.
 *   · a commercial `type` — office, retail, a whole building, a commercial
 *     villa, or the catch-all `commercial`.
 *
 * `land` is deliberately residential: it is the ambiguous one, it is the rarer
 * case, and residential is the answer an editor is least likely to have to
 * correct. Correcting it is now one dropdown.
 */
update public.properties
set segment = case
  when mode = 'commercial'
    or type in ('commercial', 'office', 'retail', 'building', 'commercial_villa')
  then 'commercial'::property_segment
  else 'residential'::property_segment
end;

alter table public.properties
  alter column segment set default 'residential',
  alter column segment set not null;

comment on column public.properties.segment is
  'Residential or commercial. The building axis, independent of `mode`, which is the transaction axis. Set per listing in the CMS; new rows default to residential.';

/*
 * Partial, and shaped like the query that uses it.
 *
 * Every public read of this column is a search: status = 'published', not
 * deleted, narrowed to one segment. A plain btree on `segment` would index the
 * archived and draft rows too — most of the table — for a filter that never
 * asks about them. Same shape as `properties_published_at_idx` beside it.
 */
create index properties_segment_idx
  on public.properties (segment)
  where status = 'published' and deleted_at is null;

/*
 * RLS is untouched on purpose.
 *
 * The existing policies gate whole rows by `status` and `deleted_at`; a new
 * column on an already-governed table inherits them, and a segment is not a
 * permission — an anonymous visitor may read the segment of any listing they
 * may already read.
 */
