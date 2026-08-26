-- 0119_media_folder_fonts.sql
-- Add 'fonts' to the media_folder enum.
--
-- The Arabic face is becoming CMS-editable (/admin/settings/typography), which
-- means the client uploads woff2/otf files the same way they upload a logo:
-- browser -> Supabase Storage on a signed URL, with a `media_assets` row
-- recorded afterwards. That row needs a folder, and every existing value is
-- wrong for it — a font in `brand/` sits in the same drawer the logo picker
-- reads, and the media library would offer it as artwork.
--
-- Its own migration file, alone, because `alter type … add value` cannot share
-- a transaction with a statement that USES the new value. Same reason 0042,
-- 0063, 0066, 0075, 0077 and 0088 are each one line.
--
-- Backward-compatible: nothing switches exhaustively over media_folder, and
-- `lib/media.ts` keeps its own UPLOAD_FOLDERS list, updated alongside this.

alter type public.media_folder add value if not exists 'fonts';
