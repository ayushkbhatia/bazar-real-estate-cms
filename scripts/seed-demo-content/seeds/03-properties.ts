/**
 * Seed 60 properties.
 *
 * Idempotency: keyed on `reference` (BAZ-AD-…). Re-running updates
 * the row in place rather than appending. assigned_agent_id is
 * resolved from ctx.agents (preloaded in 00-areas-reference.ts).
 *
 * Permits use BAZ-DEMO-#### so the compliance gate can identify
 * demo listings at a glance — they pass the structural validation
 * but are clearly not real Trakheesi numbers.
 */
import { adminClient } from "../lib/client.ts";
import { log } from "../lib/log.ts";
import { countRows } from "../lib/count.ts";
import { makeId } from "../lib/ids.ts";
import { PROPERTIES, type PropertySeed } from "../data/properties.ts";
import { resolveAreaId } from "./00-areas-reference.ts";
import type { SeedContext } from "../index.ts";

function buildReference(idx: number): string {
  // Start at 05001 to avoid colliding with the 6 existing seed.sql
  // references (BAZ-AD-04864/04887/04891/04902/04911/04920).
  return `BAZ-AD-${(5000 + idx).toString().padStart(5, "0")}`;
}

function buildPermit(idx: number): string {
  return `BAZ-DEMO-${(1000 + idx).toString().padStart(4, "0")}`;
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function buildRow(p: PropertySeed, ctx: SeedContext) {
  const areaId = resolveAreaId(ctx.ref, p.area_slug);
  const subCommunityId = p.sub_community_slug
    ? ctx.ref.areaIdBySlug.get(p.sub_community_slug) ?? null
    : null;
  const developmentId = p.development_slug
    ? ctx.ref.developmentIdBySlug.get(p.development_slug) ?? null
    : null;
  const agentId = ctx.agents.get(p.agent_slug) ?? null;

  // listing_permit_expires_at is a `date` column, not timestamptz.
  const expiry = new Date();
  expiry.setFullYear(expiry.getFullYear() + 1);
  const expiryDate = expiry.toISOString().slice(0, 10);

  return {
    id: makeId("property", 100 + p.idx),
    reference: buildReference(p.idx),
    slug: p.slug,
    title: p.title,
    short_description: p.short_description,
    description: p.description,
    mode: p.mode,
    status: "published" as const,
    type: p.type,
    area_id: areaId,
    sub_community_id: subCommunityId,
    development_id: developmentId,
    beds: p.beds,
    baths: p.baths,
    built_up_ft2: p.built_up_ft2,
    plot_ft2: p.plot_ft2 ?? null,
    year_built: p.year_built ?? null,
    tenure: p.tenure,
    furnishing: p.furnishing,
    view: p.view,
    parking_bays: p.parking_bays,
    price_aed: p.price_aed,
    service_charge_per_ft2: p.service_charge_per_ft2 ?? null,
    amenities: p.amenities,
    flags: {
      ...p.flags,
      ...(p.flags.mortgage_eligible === undefined ? { mortgage_eligible: true } : {}),
    },
    geo: p.geo,
    listing_permit_no: buildPermit(p.idx),
    listing_permit_expires_at: expiryDate,
    compliance: {
      form_a: true,
      title_deed: true,
      noc: true,
      power_of_attorney: true,
    },
    assigned_agent_id: agentId,
    published_at: isoDaysAgo(p.published_days_ago),
    view_count: 24 + p.idx * 7,
    enquiry_count: Math.max(0, p.idx % 11),
  };
}

export async function runProperties(ctx: SeedContext): Promise<void> {
  log.step(`Seeding ${PROPERTIES.length} properties`);
  const supabase = adminClient();
  const before = await countRows("properties", { col: "status", val: "published" });

  let unresolved = 0;
  for (const p of PROPERTIES) {
    const row = buildRow(p, ctx);
    if (!row.assigned_agent_id) {
      log.warn(`${p.slug} · agent ${p.agent_slug} not found in DB; assigned_agent_id=null`);
      unresolved++;
    }
    // Conflict on `id` (deterministic via makeId) rather than `reference`
    // so re-runs converge cleanly without trying to mutate the primary key.
    const { error } = await supabase
      .from("properties")
      .upsert(row, { onConflict: "id" });
    if (error) throw new Error(`upsert property ${p.slug}: ${error.message}`);
  }

  const after = await countRows("properties", { col: "status", val: "published" });
  log.summary([{ label: "properties (published)", before, after }]);
  if (unresolved > 0) log.warn(`${unresolved} listings without an assigned advisor`);
}
