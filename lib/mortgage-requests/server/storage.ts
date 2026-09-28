/**
 * Where applicants' documents live (docs/mortgage/IMPLEMENTATION.md §1.7).
 *
 * One small interface, so the choice of store stays in this file: today the
 * private Supabase bucket `mortgage-files` (migration 0140); an S3 adapter in
 * the UAE region if decision D4 requires residency. Only the service role
 * touches the bucket — it has no storage policies — and nothing here ever
 * hands a reader a URL: bytes leave only through the logged file route.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const MORTGAGE_BUCKET = "mortgage-files";

/** Object keys carry no personal data: just the file's id. */
export const fileKey = (fileId: string) => `f/${fileId}`;

export interface MortgageStorage {
  /** A URL the browser PUTs the file to, with these headers (an XHR, so progress events work). */
  presignUpload(key: string, contentType: string): Promise<{ url: string; headers: Record<string, string> }>;
  /** The object's bytes, or null when nothing was uploaded. */
  read(key: string): Promise<Uint8Array | null>;
  /** Delete objects; a key that doesn't exist is not an error. */
  remove(keys: readonly string[]): Promise<void>;
}

function isMissing(error: unknown): boolean {
  const e = error as { statusCode?: string | number; status?: number; message?: string } | null;
  return (
    String(e?.statusCode ?? "") === "404" ||
    e?.status === 404 ||
    /not.?found/i.test(e?.message ?? "")
  );
}

/** The private Supabase bucket, through a service-role client. */
export function supabaseStorage(db: SupabaseClient, bucket = MORTGAGE_BUCKET): MortgageStorage {
  const store = () => db.storage.from(bucket);
  return {
    async presignUpload(key, contentType) {
      const { data, error } = await store().createSignedUploadUrl(key);
      if (error || !data) throw new Error(`presign failed: ${error?.message ?? "no URL"}`);
      return { url: data.signedUrl, headers: { "content-type": contentType, "x-upsert": "false" } };
    },
    async read(key) {
      const { data, error } = await store().download(key);
      if (error) {
        if (isMissing(error)) return null;
        throw new Error(`read failed: ${error.message}`);
      }
      return new Uint8Array(await data.arrayBuffer());
    },
    async remove(keys) {
      if (keys.length === 0) return;
      const { error } = await store().remove([...keys]);
      if (error && !isMissing(error)) throw new Error(`remove failed: ${error.message}`);
    },
  };
}
