-- 0070_media_bucket_video.sql
-- Let the `media` bucket hold the home hero video, and give it a hard ceiling.
--
-- WHY THIS EXISTS
-- The hero video is the only upload that does not go through the `uploadMedia`
-- server action: at 25 MB it would exceed next.config.ts's 12 MB
-- serverActions.bodySizeLimit (global, no per-action override) and the host's
-- own request-body limit. It uploads browser -> Storage on a signed URL
-- instead, which means the app-side size check is advisory — a caller can put
-- whatever it likes in the ticket payload. `file_size_limit` on the bucket is
-- the ceiling that actually binds, so it is set here.
--
-- WHY THIS DOES NOT LOOSEN ANYTHING
-- Every other upload still runs through `uploadMedia`, which rejects anything
-- over MAX_UPLOAD_BYTES (10 MB, lib/media.ts) before a byte reaches Storage.
-- Raising the bucket ceiling to 25 MB therefore only affects the one control
-- that bypasses that action.
--
-- allowed_mime_types is deliberately left NULL. Setting it would mean
-- enumerating every image type plus PDF plus video, and a single omission
-- breaks all uploads — the failure mode that took out uploads in 0069. MIME
-- policy stays in app code (lib/media.ts UPLOAD_POLICIES), where it is
-- per-control.
--
-- Idempotent: re-running is a no-op.

update storage.buckets
   set file_size_limit = 26214400 -- 25 MB, matches MAX_VIDEO_UPLOAD_BYTES
 where id = 'media'
   and (file_size_limit is distinct from 26214400);
