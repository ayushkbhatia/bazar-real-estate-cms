/**
 * Concierge tool definitions in the Anthropic tool-use schema, plus their
 * server-side handlers. Each handler is async and returns a JSON-serialisable
 * object that gets fed back into the Claude function-calling loop.
 *
 * The handlers do NOT mutate state directly — they READ from Postgres (via the
 * Supabase public client) and return data. State mutation (chip updates,
 * hand-off, etc.) is the caller's job (the route handler that wraps these
 * tools loops them with Claude).
 */
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { isSupabaseConfigured } from "@/lib/env";
import {
  rankProperties,
  type ScorableProperty,
  type PropertyScore,
} from "./scoring";
import type { ConciergeBrief } from "./brief";
import type { Database } from "@/db/types";

export type ToolName =
  | "search_properties"
  | "semantic_search"
  | "get_market_stats"
  | "score_against_brief"
  | "pin_properties"
  | "hand_off_to_advisor";

/** Anthropic tool spec — the shape sent in the API request. */
export type AnthropicTool = {
  name: ToolName;
  description: string;
  input_schema: Record<string, unknown>;
};

export const CONCIERGE_TOOLS: AnthropicTool[] = [
  {
    name: "search_properties",
    description:
      "Search the live published catalogue using structured filters. Use this when the user has named specifics (area, beds, budget, type). Returns up to `limit` properties with the fields needed for scoring.",
    input_schema: {
      type: "object",
      properties: {
        mode: { type: "string", enum: ["buy", "rent", "off_plan", "commercial"] },
        type: { type: "string", description: "apartment, villa, penthouse, townhouse, etc." },
        beds_min: { type: "integer", minimum: 0, maximum: 50 },
        beds_max: { type: "integer", minimum: 0, maximum: 50 },
        price_min: { type: "number", minimum: 0 },
        price_max: { type: "number", minimum: 0 },
        area_slug: {
          type: "string",
          description: "Slug of the area (e.g. 'saadiyat-island').",
        },
        amenities: {
          type: "array",
          items: { type: "string" },
          description: "Must-have amenities like 'beach access' or 'private pool'.",
        },
        limit: { type: "integer", minimum: 1, maximum: 30, default: 12 },
      },
    },
  },
  {
    name: "semantic_search",
    description:
      "Free-text semantic search over the catalogue. Use this for fuzzy queries like 'family-friendly with walking-to-school' or anything that doesn't map cleanly to filters. Falls back to Postgres FTS if vector embeddings aren't populated yet.",
    input_schema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string", description: "Free-text query." },
        limit: { type: "integer", minimum: 1, maximum: 20, default: 8 },
      },
    },
  },
  {
    name: "get_market_stats",
    description:
      "Return basic supply + price stats for a named area: count of published listings, average AED/ft², median price. Use this to inform the user about market context, not to scope a search.",
    input_schema: {
      type: "object",
      required: ["area_slug"],
      properties: {
        area_slug: { type: "string" },
        mode: { type: "string", enum: ["buy", "rent", "off_plan", "commercial"] },
      },
    },
  },
  {
    name: "score_against_brief",
    description:
      "Given a list of property ids and the current brief, return a 0-100 match score with factor breakdown for each. Always call this right before presenting results to the user, so the score chips in the right rail stay deterministic.",
    input_schema: {
      type: "object",
      required: ["property_ids"],
      properties: {
        property_ids: {
          type: "array",
          items: { type: "string" },
          maxItems: 12,
        },
      },
    },
  },
  {
    name: "pin_properties",
    description:
      "Pin properties to the right-rail results card so the user can compare them. Pass the ids of the 3-5 strongest matches. Replaces the existing pin list.",
    input_schema: {
      type: "object",
      required: ["property_ids"],
      properties: {
        property_ids: {
          type: "array",
          items: { type: "string" },
          maxItems: 8,
        },
      },
    },
  },
  {
    name: "hand_off_to_advisor",
    description:
      "Hand the session over to a live Bazar advisor. Use this when the user asks for human help, when the brief is too nuanced to score, or when they want to schedule a viewing. Returns a confirmation that an advisor will reach out.",
    input_schema: {
      type: "object",
      properties: {
        message: { type: "string", description: "Optional context for the advisor." },
      },
    },
  },
];

// ───────────────────────────────────────────────────────────────
// Tool handlers
// ───────────────────────────────────────────────────────────────

export type ToolInput = Record<string, unknown>;

export type ToolHandlerContext = {
  brief: ConciergeBrief;
  pinnedIds: string[];
};

export type ToolHandlerResult = {
  /** JSON-serialisable payload returned to Claude as the tool result. */
  output: unknown;
  /** Optional state patches that the route should apply to the session. */
  state?: {
    pinned_property_ids?: string[];
    hand_off?: { message?: string };
  };
};

export type ToolHandler = (
  input: ToolInput,
  ctx: ToolHandlerContext,
) => Promise<ToolHandlerResult>;

/** Map of tool name → handler. The route handler routes the LLM's tool_use
 *  blocks through this map and feeds the result back. */
export const TOOL_HANDLERS: Record<ToolName, ToolHandler> = {
  search_properties: handleSearchProperties,
  semantic_search: handleSemanticSearch,
  get_market_stats: handleGetMarketStats,
  score_against_brief: handleScoreAgainstBrief,
  pin_properties: handlePinProperties,
  hand_off_to_advisor: handleHandOff,
};

const SEARCH_FIELDS =
  "id, reference, slug, title, short_description, price_aed, mode, type, beds, baths, built_up_ft2, amenities, flags, areas:area_id(name, slug)";

type RawSearchRow = {
  id: string;
  reference: string;
  slug: string;
  title: string;
  short_description: string | null;
  price_aed: number | string;
  mode: ScorableProperty["mode"];
  type: string;
  beds: number;
  baths: number;
  built_up_ft2: number | null;
  amenities: string[] | null;
  flags: ScorableProperty["flags"];
  areas: { name: string; slug: string } | null;
};

function rowToScorable(row: RawSearchRow): ScorableProperty {
  return {
    id: row.id,
    reference: row.reference,
    title: row.title,
    price_aed: Number(row.price_aed),
    mode: row.mode,
    type: row.type,
    beds: row.beds,
    baths: row.baths,
    built_up_ft2: row.built_up_ft2,
    amenities: row.amenities ?? [],
    flags: row.flags,
    area_slug: row.areas?.slug ?? null,
    area_name: row.areas?.name ?? null,
  };
}

async function handleSearchProperties(
  input: ToolInput,
): Promise<ToolHandlerResult> {
  if (!isSupabaseConfigured)
    return { output: { error: "Supabase not configured", results: [] } };
  const supabase = createSupabasePublicClient();
  let query = supabase
    .from("properties")
    .select(SEARCH_FIELDS)
    .eq("status", "published")
    .is("deleted_at", null);

  if (typeof input.mode === "string")
    query = query.eq("mode", input.mode as ScorableProperty["mode"]);
  if (typeof input.type === "string")
    query = query.eq(
      "type",
      input.type as Database["public"]["Enums"]["property_type"],
    );
  if (typeof input.beds_min === "number") query = query.gte("beds", input.beds_min);
  if (typeof input.beds_max === "number") query = query.lte("beds", input.beds_max);
  if (typeof input.price_min === "number")
    query = query.gte("price_aed", input.price_min);
  if (typeof input.price_max === "number")
    query = query.lte("price_aed", input.price_max);

  // Area: resolve slug → id (the same dance listPublishedProperties does).
  if (typeof input.area_slug === "string") {
    const { data: area } = await supabase
      .from("areas")
      .select("id")
      .eq("slug", input.area_slug)
      .maybeSingle();
    if (area?.id) query = query.eq("area_id", area.id);
    else return { output: { results: [], note: `No area: ${input.area_slug}` } };
  }

  const limit = typeof input.limit === "number" ? Math.min(input.limit, 30) : 12;
  query = query.order("published_at", { ascending: false }).limit(limit);

  const { data, error } = await query;
  if (error) return { output: { error: error.message, results: [] } };

  const rows = (data ?? []).map((r) => rowToScorable(r as unknown as RawSearchRow));

  // Post-filter amenities (Postgres can't easily filter array contains a set
  // of needles without a function — do it in JS for now).
  let filtered = rows;
  if (Array.isArray(input.amenities) && input.amenities.length > 0) {
    const required = (input.amenities as string[]).map((a) => a.toLowerCase());
    filtered = rows.filter((r) => {
      const have = r.amenities.map((a) => a.toLowerCase());
      return required.every((req) =>
        have.some((h) => h.includes(req) || req.includes(h)),
      );
    });
  }

  return {
    output: {
      results: filtered.map(toLeanRow),
      count: filtered.length,
    },
  };
}

async function handleSemanticSearch(
  input: ToolInput,
): Promise<ToolHandlerResult> {
  if (!isSupabaseConfigured)
    return { output: { error: "Supabase not configured", results: [] } };
  const supabase = createSupabasePublicClient();
  const query = typeof input.query === "string" ? input.query : "";
  if (!query.trim())
    return { output: { results: [], note: "Empty query." } };
  const limit = typeof input.limit === "number" ? Math.min(input.limit, 20) : 8;

  // Sprint 12: try Voyage + pgvector cosine first. Falls back to FTS
  // when either is unconfigured / empty / errored. Both paths return
  // the same lean row shape so callers don't branch.
  const { embed } = await import("@/lib/embeddings");
  const { isVoyageConfigured } = await import("@/lib/env");
  if (isVoyageConfigured) {
    const vec = await embed(query, "query");
    if (vec) {
      try {
        // Vector-similarity query — order by cosine distance ASC
        // (smaller = closer). pgvector supports the `<=>` operator;
        // use rpc when the index is sparse for better performance.
        // query_embedding is pgvector, emitted as `string` by the type
        // generator; PostgREST accepts a JSON number array and casts it.
        const { data: vecMatches } = await supabase.rpc("match_properties", {
          query_embedding: vec as unknown as string,
          match_limit: limit,
        });
        if (Array.isArray(vecMatches) && vecMatches.length > 0) {
          const ids = (vecMatches as { property_id: string }[]).map(
            (m) => m.property_id,
          );
          const { data } = await supabase
            .from("properties")
            .select(SEARCH_FIELDS)
            .in("id", ids)
            .eq("status", "published")
            .is("deleted_at", null);
          // preserve cosine order
          const order = new Map(ids.map((id, i) => [id, i]));
          const rows = (data ?? [])
            .map((r) => rowToScorable(r as unknown as RawSearchRow))
            .sort(
              (a, b) =>
                (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99),
            );
          return {
            output: {
              results: rows.map(toLeanRow),
              count: rows.length,
              mode: "vector",
            },
          };
        }
      } catch {
        // RPC missing or embedding column absent — fall through.
      }
    }
  }

  // Postgres FTS fallback.
  const { data, error } = await supabase
    .from("properties")
    .select(SEARCH_FIELDS)
    .textSearch("search_text", query, { type: "websearch", config: "english" })
    .eq("status", "published")
    .is("deleted_at", null)
    .limit(limit);
  if (error) return { output: { error: error.message, results: [] } };

  const rows = (data ?? []).map((r) => rowToScorable(r as unknown as RawSearchRow));
  return {
    output: { results: rows.map(toLeanRow), count: rows.length, mode: "fts" },
  };
}

async function handleGetMarketStats(
  input: ToolInput,
): Promise<ToolHandlerResult> {
  if (!isSupabaseConfigured)
    return { output: { error: "Supabase not configured" } };
  const supabase = createSupabasePublicClient();
  const slug = typeof input.area_slug === "string" ? input.area_slug : "";
  if (!slug) return { output: { error: "area_slug is required" } };

  const { data: area } = await supabase
    .from("areas")
    .select("id, name")
    .eq("slug", slug)
    .maybeSingle();
  if (!area) return { output: { error: `No area: ${slug}` } };

  let q = supabase
    .from("properties")
    .select("price_aed, built_up_ft2")
    .eq("status", "published")
    .eq("area_id", area.id)
    .is("deleted_at", null);
  if (typeof input.mode === "string")
    q = q.eq("mode", input.mode as ScorableProperty["mode"]);

  const { data, error } = await q;
  if (error) return { output: { error: error.message } };

  const rows = (data ?? []) as { price_aed: number | string; built_up_ft2: number | null }[];
  if (rows.length === 0)
    return {
      output: {
        area: area.name,
        count: 0,
        avg_price_per_ft2: null,
        median_price_aed: null,
      },
    };

  const prices = rows.map((r) => Number(r.price_aed)).sort((a, b) => a - b);
  const pricePerFt = rows
    .filter((r) => r.built_up_ft2 && r.built_up_ft2 > 0)
    .map((r) => Number(r.price_aed) / r.built_up_ft2!);
  const avg =
    pricePerFt.length === 0
      ? null
      : Math.round(pricePerFt.reduce((s, v) => s + v, 0) / pricePerFt.length);
  const median = prices[Math.floor(prices.length / 2)];

  return {
    output: {
      area: area.name,
      count: rows.length,
      avg_price_per_ft2: avg,
      median_price_aed: median,
    },
  };
}

async function handleScoreAgainstBrief(
  input: ToolInput,
  ctx: ToolHandlerContext,
): Promise<ToolHandlerResult> {
  if (!isSupabaseConfigured)
    return { output: { error: "Supabase not configured", scores: [] } };
  const ids = Array.isArray(input.property_ids)
    ? (input.property_ids as string[]).slice(0, 12)
    : [];
  if (ids.length === 0)
    return { output: { scores: [] } };

  const supabase = createSupabasePublicClient();
  const { data, error } = await supabase
    .from("properties")
    .select(SEARCH_FIELDS)
    .in("id", ids)
    .eq("status", "published")
    .is("deleted_at", null);
  if (error) return { output: { error: error.message, scores: [] } };

  const props = (data ?? []).map((r) =>
    rowToScorable(r as unknown as RawSearchRow),
  );
  const scores = rankProperties(props, ctx.brief);
  return { output: { scores } };
}

async function handlePinProperties(
  input: ToolInput,
): Promise<ToolHandlerResult> {
  const ids = Array.isArray(input.property_ids)
    ? (input.property_ids as string[]).slice(0, 8)
    : [];
  return {
    output: { pinned: ids.length },
    state: { pinned_property_ids: ids },
  };
}

async function handleHandOff(input: ToolInput): Promise<ToolHandlerResult> {
  const message = typeof input.message === "string" ? input.message : undefined;
  return {
    output: {
      handed_off: true,
      message:
        "Your brief is now in front of a Bazar advisor — Mariam Al-Hashimi will reach out within an hour during UAE business hours.",
    },
    state: { hand_off: { message } },
  };
}

// ───────────────────────────────────────────────────────────────
// Lean property shape — what we feed back to Claude. We strip ID prefixes
// and long text to save tokens.
// ───────────────────────────────────────────────────────────────
type LeanRow = {
  id: string;
  ref: string;
  title: string;
  area: string | null;
  mode: ScorableProperty["mode"];
  type: string;
  beds: number;
  baths: number;
  built_up_ft2: number | null;
  price_aed: number;
  amenities: string[];
  flags: ScorableProperty["flags"];
};

function toLeanRow(p: ScorableProperty): LeanRow {
  return {
    id: p.id,
    ref: p.reference,
    title: p.title,
    area: p.area_name,
    mode: p.mode,
    type: p.type,
    beds: p.beds,
    baths: p.baths,
    built_up_ft2: p.built_up_ft2,
    price_aed: p.price_aed,
    amenities: p.amenities.slice(0, 8),
    flags: p.flags,
  };
}

/** Convenience: get the tools that we expose for a session. Anonymous
 *  sessions cannot hand off (we ask them to sign in instead). */
export function toolsForSession(opts: { anonymous: boolean }): AnthropicTool[] {
  if (!opts.anonymous) return CONCIERGE_TOOLS;
  return CONCIERGE_TOOLS.filter((t) => t.name !== "hand_off_to_advisor");
}

/** Default rank fallback (when LLM never called score_against_brief).
 *  Pure proxy to rankProperties — kept here for the route to import. */
export function defaultRank(
  rows: ScorableProperty[],
  brief: ConciergeBrief,
): PropertyScore[] {
  return rankProperties(rows, brief);
}

export type { ScorableProperty };
