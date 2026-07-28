import { AlertTriangle } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { mediaPublicUrl } from "@/lib/media";
import { currentStaffRow } from "@/lib/queries/staff";
import { buildMediaUsageIndex } from "@/lib/queries/media-usage";
import {
  canTrash,
  deriveMediaState,
  matchesStateFilter,
  sortUsages,
  MEDIA_STATE_FILTERS,
  type MediaStateFilter,
} from "@/lib/media-usage";
import { MediaUploader } from "./_upload";
import { MediaFolderRail } from "./_components/folder-rail";
import { MediaSearchInput } from "./_components/search";
import { MediaStateTabs } from "./_components/state-tabs";
import { MediaViewToggle } from "./_components/view-toggle";
import { MediaLibrary, type MediaLibraryItem } from "./_components/library";

export const dynamic = "force-dynamic";

/** Assets scanned per page load. Usage is resolved for every one of them. */
const PAGE_SIZE = 200;
/** Matches the copy on the trash view — nothing auto-purges yet. */
const TRASH_WINDOW_DAYS = 30;

const MEDIA_FOLDERS = [
  "listings",
  "brand",
  "blog",
  "team",
  "documents",
] as const;
type MediaFolder = (typeof MEDIA_FOLDERS)[number];

function asFolder(value: string): MediaFolder | null {
  return (MEDIA_FOLDERS as readonly string[]).includes(value)
    ? (value as MediaFolder)
    : null;
}

type MediaRow = {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number | null;
  storage_key: string;
  folder: string;
  created_at: string;
  deleted_at: string | null;
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function one(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

async function fetchMedia(opts: {
  folder: string;
  trashed: boolean;
  q: string;
}): Promise<MediaRow[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("media_assets")
    .select(
      "id, filename, mime_type, size_bytes, storage_key, folder, created_at, deleted_at",
    );

  query = opts.trashed
    ? query.not("deleted_at", "is", null)
    : query.is("deleted_at", null);

  const folder = asFolder(opts.folder);
  if (folder) {
    query = query.eq("folder", folder);
  }
  if (opts.q) {
    // `or()` takes a comma-separated filter list, so strip the characters that
    // would break out of one value into the next.
    const term = opts.q.replace(/[%,()]/g, " ").trim();
    if (term) {
      query = query.or(`filename.ilike.%${term}%,alt_text.ilike.%${term}%`);
    }
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);
  if (error || !data) {
    if (error) console.error("[media] fetch failed", error);
    return [];
  }
  return data as MediaRow[];
}

/** Per-folder counts for the rail — head-only, no rows over the wire. */
async function folderCounts(): Promise<Record<string, number>> {
  if (!isSupabaseConfigured) return {};
  const supabase = await createSupabaseServerClient();
  const entries = await Promise.all([
    ...MEDIA_FOLDERS.map(async (folder) => {
      const { count } = await supabase
        .from("media_assets")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("folder", folder);
      return [folder, count ?? 0] as const;
    }),
    (async () => {
      const { count } = await supabase
        .from("media_assets")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null);
      return ["all", count ?? 0] as const;
    })(),
    (async () => {
      const { count } = await supabase
        .from("media_assets")
        .select("id", { count: "exact", head: true })
        .not("deleted_at", "is", null);
      return ["trash", count ?? 0] as const;
    })(),
  ]);
  return Object.fromEntries(entries);
}

function daysSince(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

export default async function MediaPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const folder = one(sp.folder) || "all";
  const trashView = folder === "trash";
  const q = one(sp.q);
  const requestedState = one(sp.state) as MediaStateFilter;
  const stateFilter: MediaStateFilter = MEDIA_STATE_FILTERS.includes(
    requestedState,
  )
    ? requestedState
    : "all";
  const view = one(sp.view) === "list" ? "list" : "grid";

  const [rows, counts, staff] = await Promise.all([
    fetchMedia({ folder, trashed: trashView, q }),
    folderCounts(),
    currentStaffRow(),
  ]);

  const usageIndex = await buildMediaUsageIndex(
    rows.map((r) => ({ id: r.id, storage_key: r.storage_key })),
  );

  const all: MediaLibraryItem[] = rows.map((row) => {
    const usages = sortUsages(usageIndex.byAsset.get(row.id) ?? []);
    const state = deriveMediaState(usages);
    return {
      id: row.id,
      filename: row.filename,
      mime_type: row.mime_type,
      size_bytes: row.size_bytes,
      url: mediaPublicUrl(row.storage_key),
      folder: row.folder,
      created_at: row.created_at,
      deleted_at: row.deleted_at,
      daysInTrash: row.deleted_at
        ? Math.max(0, TRASH_WINDOW_DAYS - daysSince(row.deleted_at))
        : null,
      usages,
      state,
      trashable: canTrash({ state, indexPartial: usageIndex.partial }),
    };
  });

  const stateCounts = Object.fromEntries(
    MEDIA_STATE_FILTERS.map((f) => [
      f,
      f === "all" ? all.length : all.filter((i) => i.state === f).length,
    ]),
  ) as Record<MediaStateFilter, number>;

  const items = all.filter((i) => matchesStateFilter(i.state, stateFilter));
  const bytes = all.reduce((sum, i) => sum + (i.size_bytes ?? 0), 0);
  const reclaimable = all
    .filter((i) => i.state === "unused")
    .reduce((sum, i) => sum + (i.size_bytes ?? 0), 0);

  return (
    <CmsShell
      title="Media library"
      breadcrumbs="Catalogue"
      primary={<MediaUploader />}
    >
      <div className="flex gap-6 items-start">
        <MediaFolderRail counts={counts} />

        <div className="min-w-0 flex-1 flex flex-col gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-[260px]">
              <MediaSearchInput />
            </div>
            <MediaStateTabs counts={stateCounts} />
            <div className="ml-auto">
              <MediaViewToggle />
            </div>
          </div>

          {usageIndex.partial ? (
            <p className="flex items-start gap-2 rounded-md border border-[oklch(0.85_0.09_80)] bg-[oklch(0.98_0.03_90)] px-3 py-2 text-[12.5px] text-[oklch(0.4_0.1_60)]">
              <AlertTriangle size={13} className="mt-0.5 flex-shrink-0" />
              <span>
                Usage couldn&apos;t be read from{" "}
                <span className="mono">
                  {usageIndex.failedSources.join(", ")}
                </span>
                . Files may look unused when they aren&apos;t, so deleting is
                disabled until this loads cleanly.
              </span>
            </p>
          ) : null}

          <div className="flex items-center gap-2 text-[12.5px] text-bz-muted">
            <span>
              {items.length} of {all.length}{" "}
              {all.length === 1 ? "asset" : "assets"}
              {trashView ? " in trash" : ""}
            </span>
            <span>·</span>
            <span className="mono">{formatBytes(bytes)}</span>
            {!trashView && reclaimable > 0 ? (
              <>
                <span>·</span>
                <span>
                  <span className="mono">{formatBytes(reclaimable)}</span>{" "}
                  reclaimable
                </span>
              </>
            ) : null}
          </div>

          <MediaLibrary
            items={items}
            view={view}
            trashView={trashView}
            canDestroy={staff?.role === "admin"}
          />
        </div>
      </div>
    </CmsShell>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
