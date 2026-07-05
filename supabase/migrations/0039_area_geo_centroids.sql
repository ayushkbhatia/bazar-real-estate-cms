-- 0039_area_geo_centroids.sql
-- Interactive area map (Sprint 16): backfill area centroids.
--
-- The `areas` table has a `geo jsonb` column but none of the Abu-Dhabi
-- `area`-kind rows carry a centroid yet, so the home-page + area-detail
-- map has nothing to place a pin on. This seeds a `{"lat":…,"lng":…}`
-- centroid (same shape as `properties.geo`) for each Abu-Dhabi area.
--
-- Coordinates are hand-verified place centroids. For the nine areas that
-- already have published listings they sit within ~0.02° of the computed
-- avg-of-member-property centroid; the three with zero listings today
-- (Khalifa City, Masdar City, Nurai Island) can only be hand-seeded and
-- are included so the full area set is map-ready once they get inventory.
--
-- Idempotent: only fills rows where `geo` is still null, so re-running
-- (or a later manual correction) is never clobbered.

update public.areas a
set geo = v.geo
from (
  values
    ('saadiyat-island', '{"lat":24.545,"lng":54.435}'::jsonb),
    ('yas-island',      '{"lat":24.488,"lng":54.605}'::jsonb),
    ('al-reem-island',  '{"lat":24.500,"lng":54.404}'::jsonb),
    ('al-maryah',       '{"lat":24.499,"lng":54.386}'::jsonb),
    ('adgm',            '{"lat":24.503,"lng":54.382}'::jsonb),
    ('al-raha',         '{"lat":24.452,"lng":54.606}'::jsonb),
    ('corniche',        '{"lat":24.476,"lng":54.349}'::jsonb),
    ('khalifa-city',    '{"lat":24.420,"lng":54.578}'::jsonb),
    ('masdar-city',     '{"lat":24.427,"lng":54.617}'::jsonb),
    ('kizad',           '{"lat":24.717,"lng":54.683}'::jsonb),
    ('mussafah',        '{"lat":24.350,"lng":54.494}'::jsonb),
    ('nurai-island',    '{"lat":24.590,"lng":54.470}'::jsonb)
) as v(slug, geo)
where a.slug = v.slug
  and a.kind = 'area'
  and a.geo is null;
