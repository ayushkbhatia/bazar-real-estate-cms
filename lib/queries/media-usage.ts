import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { MediaUsage } from "@/lib/media-usage";

/**
 * Where every media asset is used, across every surface that can reference one.
 *
 * There is no maintained back-reference in the schema (`media_assets.usage_count`
 * exists but nothing has ever written to it), so this reads the truth from the
 * referencing tables on each load. One query per source; a source that fails is
 * recorded in `failedSources` rather than silently contributing zero rows,
 * because "no usages found" is exactly what unlocks the delete button.
 */
export type MediaUsageIndex = {
  byAsset: Map<string, MediaUsage[]>;
  /** Sources that errored. Non-empty ⇒ the index is incomplete. */
  failedSources: string[];
  partial: boolean;
};

export type UsageAsset = { id: string; storage_key: string };

/** How many ids ride along in one `.in()` filter. */
const ID_BATCH = 50;

const EMPTY: MediaUsageIndex = {
  byAsset: new Map(),
  failedSources: [],
  partial: false,
};

export async function buildMediaUsageIndex(
  assets: UsageAsset[],
): Promise<MediaUsageIndex> {
  if (!isSupabaseConfigured || assets.length === 0) return EMPTY;

  const ids = assets.map((a) => a.id);
  const supabase = await createSupabaseServerClient();
  const byAsset = new Map<string, MediaUsage[]>();
  const failedSources: string[] = [];

  function add(assetId: string | null | undefined, usage: MediaUsage) {
    if (!assetId) return;
    const list = byAsset.get(assetId);
    if (list) list.push(usage);
    else byAsset.set(assetId, [usage]);
  }

  /** Run one source; on failure record it instead of pretending it's empty. */
  async function source(name: string, run: () => Promise<void>) {
    try {
      await run();
    } catch (error) {
      console.error(`[media-usage] source "${name}" failed`, error);
      failedSources.push(name);
    }
  }

  type Q = { data: unknown; error: { message: string } | null };
  function rows<T>(res: Q, name: string): T[] {
    if (res.error) throw new Error(`${name}: ${res.error.message}`);
    return (res.data as T[] | null) ?? [];
  }

  /** `.in()` filters travel in the query string, so a page's worth of uuids is
   *  split into batches that keep every URL comfortably short. */
  async function inChunks<T>(
    name: string,
    query: (batch: string[]) => PromiseLike<Q>,
  ): Promise<T[]> {
    const out: T[] = [];
    for (let i = 0; i < ids.length; i += ID_BATCH) {
      out.push(...rows<T>(await query(ids.slice(i, i + ID_BATCH)), name));
    }
    return out;
  }

  await Promise.all([
    // ── Listings ────────────────────────────────────────────────────────
    source("property_media", async () => {
      type Row = {
        media_id: string;
        role: string;
        properties: {
          id: string;
          title: string;
          status: string;
          deleted_at: string | null;
        } | null;
      };
      const found = await inChunks<Row>("property_media", (batch) =>
        supabase
          .from("property_media")
          .select(
            "media_id, role, properties:property_id(id, title, status, deleted_at)",
          )
          .in("media_id", batch),
      );
      for (const r of found) {
        if (!r.properties) continue;
        add(r.media_id, {
          kind: "property",
          id: r.properties.id,
          label: r.properties.title,
          role: roleLabel(r.role),
          href: `/admin/properties/${r.properties.id}`,
          live:
            r.properties.status === "published" &&
            r.properties.deleted_at === null,
          internal: false,
        });
      }
    }),

    // ── Developments: gallery, hero, masterplan, brochure, floor plans ──
    source("development_media", async () => {
      type Row = {
        media_id: string;
        role: string;
        developments: {
          id: string;
          name: string;
          published_at: string | null;
        } | null;
      };
      const found = await inChunks<Row>("development_media", (batch) =>
        supabase
          .from("development_media")
          .select(
            "media_id, role, developments:development_id(id, name, published_at)",
          )
          .in("media_id", batch),
      );
      for (const r of found) {
        if (!r.developments) continue;
        add(r.media_id, developmentUsage(r.developments, roleLabel(r.role)));
      }
    }),

    source("developments", async () => {
      type Row = {
        id: string;
        name: string;
        published_at: string | null;
        hero_image_id: string | null;
        masterplan_id: string | null;
        brochure_id: string | null;
      };
      const columns = [
        ["hero_image_id", "Hero"],
        ["masterplan_id", "Masterplan"],
        ["brochure_id", "Brochure"],
      ] as const;
      for (const [column, role] of columns) {
        const found = await inChunks<Row>("developments", (batch) =>
          supabase
            .from("developments")
            .select("id, name, published_at, " + column)
            .in(column, batch),
        );
        for (const r of found) {
          add(r[column], developmentUsage(r, role));
        }
      }
    }),

    source("floor_plans", async () => {
      type Row = {
        media_id: string | null;
        label: string;
        developments: {
          id: string;
          name: string;
          published_at: string | null;
        } | null;
      };
      const found = await inChunks<Row>("floor_plans", (batch) =>
        supabase
          .from("floor_plans")
          .select(
            "media_id, label, developments:development_id(id, name, published_at)",
          )
          .in("media_id", batch),
      );
      for (const r of found) {
        if (!r.developments) continue;
        add(r.media_id, {
          kind: "floor_plan",
          id: r.developments.id,
          label: `${r.developments.name} — ${r.label}`,
          role: "Floor plan",
          href: `/admin/developments/${r.developments.id}`,
          live: r.developments.published_at !== null,
          internal: false,
        });
      }
    }),

    // ── Editorial ───────────────────────────────────────────────────────
    source("articles", async () => {
      type Row = {
        id: string;
        title: string;
        status: string;
        deleted_at: string | null;
        hero_image_id: string | null;
        body_html: string | null;
      };
      const res = await supabase
        .from("articles")
        .select("id, title, status, deleted_at, hero_image_id, body_html")
        .is("deleted_at", null)
        .limit(1000);
      const all = rows<Row>(res, "articles");
      for (const r of all) {
        const usage = (role: string): MediaUsage => ({
          kind: "article",
          id: r.id,
          label: r.title,
          role,
          href: `/admin/blog/${r.id}`,
          live: r.status === "published",
          internal: false,
        });
        if (r.hero_image_id && ids.includes(r.hero_image_id)) {
          add(r.hero_image_id, usage("Hero"));
        }
        // Body images are embedded as public storage URLs, not as a foreign
        // key — match on the storage key so an in-body image isn't reported
        // as unused and offered for deletion.
        if (r.body_html) {
          for (const asset of assets) {
            if (asset.id === r.hero_image_id) continue;
            if (r.body_html.includes(asset.storage_key)) {
              add(asset.id, usage("In body"));
            }
          }
        }
      }
    }),

    source("pages", async () => {
      type Row = {
        id: string;
        title: string;
        slug: string;
        status: string;
        blocks: unknown;
      };
      const res = await supabase
        .from("pages")
        .select("id, title, slug, status, blocks")
        .limit(1000);
      for (const r of rows<Row>(res, "pages")) {
        for (const mediaId of collectMediaIds(r.blocks)) {
          if (!ids.includes(mediaId)) continue;
          add(mediaId, {
            kind: "page",
            id: r.id,
            label: r.title,
            role: "Block image",
            href: `/admin/pages/${r.id}`,
            live: r.status === "published",
            internal: false,
          });
        }
      }
    }),

    // ── Catalogue chrome ────────────────────────────────────────────────
    source("areas", async () => {
      type Row = { id: string; name: string; hero_image_id: string | null };
      const found = await inChunks<Row>("areas", (batch) =>
        supabase
          .from("areas")
          .select("id, name, hero_image_id")
          .in("hero_image_id", batch),
      );
      for (const r of found) {
        add(r.hero_image_id, {
          kind: "area",
          id: r.id,
          label: r.name,
          role: "Hero",
          href: `/admin/areas/${r.id}`,
          live: true,
          internal: false,
        });
      }
    }),

    // area_guides / developer_profiles are keyed on their parent row, not on
    // an `id` of their own.
    source("area_guides", async () => {
      type Row = {
        area_id: string;
        published_at: string | null;
        hero_image_id: string | null;
        areas: { name: string; slug: string } | null;
      };
      const found = await inChunks<Row>("area_guides", (batch) =>
        supabase
          .from("area_guides")
          .select("area_id, published_at, hero_image_id, areas:area_id(name, slug)")
          .in("hero_image_id", batch),
      );
      for (const r of found) {
        add(r.hero_image_id, {
          kind: "area_guide",
          id: r.area_id,
          label: r.areas?.name ?? "Area guide",
          role: "Hero",
          href: `/admin/areas/${r.area_id}`,
          live: r.published_at !== null,
          internal: false,
        });
      }
    }),

    source("developers", async () => {
      type Row = { id: string; name: string; logo_id: string | null };
      const found = await inChunks<Row>("developers", (batch) =>
        supabase
          .from("developers")
          .select("id, name, logo_id")
          .in("logo_id", batch),
      );
      for (const r of found) {
        add(r.logo_id, {
          kind: "developer",
          id: r.id,
          label: r.name,
          role: "Logo",
          href: `/admin/developers/${r.id}`,
          live: true,
          internal: false,
        });
      }
    }),

    source("developer_profiles", async () => {
      type Row = {
        developer_id: string;
        published_at: string | null;
        hero_image_id: string | null;
        developers: { name: string } | null;
      };
      const found = await inChunks<Row>("developer_profiles", (batch) =>
        supabase
          .from("developer_profiles")
          .select(
            "developer_id, published_at, hero_image_id, developers:developer_id(name)",
          )
          .in("hero_image_id", batch),
      );
      for (const r of found) {
        add(r.hero_image_id, {
          kind: "developer_profile",
          id: r.developer_id,
          label: r.developers?.name ?? "Developer profile",
          role: "Hero",
          href: `/admin/developers/${r.developer_id}`,
          live: r.published_at !== null,
          internal: false,
        });
      }
    }),

    source("megamenu_featured_tiles", async () => {
      type Row = {
        id: string;
        headline: string | null;
        media_asset_id: string | null;
      };
      const found = await inChunks<Row>("megamenu_featured_tiles", (batch) =>
        supabase
          .from("megamenu_featured_tiles")
          .select("id, headline, media_asset_id")
          .in("media_asset_id", batch),
      );
      for (const r of found) {
        add(r.media_asset_id, {
          kind: "megamenu",
          id: r.id,
          label: r.headline ?? "Featured tile",
          role: "Featured tile",
          href: "/admin/settings/navigation",
          live: true,
          internal: false,
        });
      }
    }),

    // ── Internal surfaces — never public, but still in use ───────────────
    source("documents", async () => {
      type Row = {
        id: string;
        kind: string;
        filename: string | null;
        media_id: string | null;
      };
      const found = await inChunks<Row>("documents", (batch) =>
        supabase
          .from("documents")
          .select("id, kind, filename, media_id")
          .in("media_id", batch),
      );
      for (const r of found) {
        add(r.media_id, {
          kind: "document",
          id: r.id,
          label: r.filename ?? roleLabel(r.kind),
          role: "Deal attachment",
          href: null,
          live: false,
          internal: true,
        });
      }
    }),

    source("licenses", async () => {
      type Row = {
        id: string;
        kind: string;
        number: string | null;
        file_id: string | null;
      };
      const found = await inChunks<Row>("licenses", (batch) =>
        supabase
          .from("licenses")
          .select("id, kind, number, file_id")
          .in("file_id", batch),
      );
      for (const r of found) {
        add(r.file_id, {
          kind: "license",
          id: r.id,
          label: [roleLabel(r.kind), r.number].filter(Boolean).join(" · "),
          role: "Licence file",
          href: "/admin/settings/compliance",
          live: false,
          internal: true,
        });
      }
    }),
  ]);

  return { byAsset, failedSources, partial: failedSources.length > 0 };
}

function developmentUsage(
  development: { id: string; name: string; published_at: string | null },
  role: string,
): MediaUsage {
  return {
    kind: "development",
    id: development.id,
    label: development.name,
    role,
    href: `/admin/developments/${development.id}`,
    live: development.published_at !== null,
    internal: false,
  };
}

function roleLabel(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1).replace(/_/g, " ");
}

/** Walk a page's `blocks` jsonb for every `media_id` it embeds. */
export function collectMediaIds(blocks: unknown): string[] {
  const found = new Set<string>();
  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!node || typeof node !== "object") return;
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === "media_id" && typeof value === "string" && value) {
        found.add(value);
      } else {
        walk(value);
      }
    }
  };
  walk(blocks);
  return [...found];
}
