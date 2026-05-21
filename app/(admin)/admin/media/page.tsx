import Image from "next/image";
import { CmsShell } from "@/components/brand/cms-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { mediaPublicUrl } from "@/lib/media";
import { MediaUploader } from "./_upload";

export const dynamic = "force-dynamic";

type MediaRow = {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number | null;
  storage_key: string;
  width: number | null;
  height: number | null;
  folder: string;
  created_at: string;
};

async function fetchMedia(): Promise<MediaRow[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("media_assets")
    .select(
      "id, filename, mime_type, size_bytes, storage_key, width, height, folder, created_at",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error || !data) return [];
  return data as MediaRow[];
}

function formatBytes(n: number | null): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export default async function MediaPage() {
  const rows = await fetchMedia();

  return (
    <CmsShell
      title="Media library"
      breadcrumbs="Catalogue"
      primary={<MediaUploader />}
    >
      <div className="flex flex-col gap-6">
        <div className="text-[13px] text-bz-muted">
          {rows.length} {rows.length === 1 ? "asset" : "assets"}
        </div>
        {rows.length === 0 ? (
          <div className="bg-bz-surface border border-bz-border rounded-lg p-12 text-center text-bz-muted">
            No media yet. Upload your first asset using the button above.
          </div>
        ) : (
          <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {rows.map((row) => {
              const isImage = row.mime_type.startsWith("image/");
              return (
                <li
                  key={row.id}
                  className="bg-bz-surface border border-bz-border rounded-lg overflow-hidden flex flex-col"
                >
                  <div className="relative aspect-[4/3] bg-bz-surface-2">
                    {isImage ? (
                      <Image
                        src={mediaPublicUrl(row.storage_key)}
                        alt={row.filename}
                        fill
                        sizes="(max-width: 1024px) 50vw, 25vw"
                        className="object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-bz-muted mono text-[11px] uppercase">
                        {row.mime_type.split("/")[1] ?? "file"}
                      </div>
                    )}
                  </div>
                  <div className="px-3 py-2.5 flex flex-col gap-0.5">
                    <div className="text-[13px] font-medium truncate">
                      {row.filename}
                    </div>
                    <div className="text-[11px] text-bz-muted flex gap-2">
                      <span>{formatBytes(row.size_bytes)}</span>
                      <span>·</span>
                      <span className="mono">{row.folder}</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </CmsShell>
  );
}
