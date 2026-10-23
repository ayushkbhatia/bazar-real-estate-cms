/**
 * @vitest-environment node
 */

/**
 * Migration 0167 against the local Supabase stack:
 *
 *   npm run db:local:reset && npm run test:db
 *
 * Skipped with a warning when the stack isn't running, and left out of
 * `npm run test:run`, which has no database of its own.
 *
 * An area that a published listing, published project or child area still
 * points at can't be deleted by anyone — the service role included, which
 * skips RLS and so is what a script or the SQL editor would use. The refusal
 * names what is linked. Unpublished listings and projects don't hold it: the
 * delete goes through and leaves them without an area (0170).
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  client,
  localStack,
  type LocalStack,
} from "./mortgage-requests/testing/local-stack";

const stack = localStack();
if (!stack) {
  console.warn("area delete-guard tests skipped: start the local stack with `npm run db:local:reset`");
}

describe.skipIf(!stack)("areas delete guard (local Supabase)", () => {
  const local = stack as LocalStack;
  const tag = randomUUID().slice(0, 8);
  let service: SupabaseClient;
  const created: string[] = [];
  const createdProperties: string[] = [];
  const createdDevelopments: string[] = [];

  async function makeProperty(fields: Record<string, unknown>) {
    const n = createdProperties.length;
    const { data, error } = await service
      .from("properties")
      .insert({
        title: `Guard test listing ${n} ${tag}`,
        slug: `guard-listing-${n}-${tag}`,
        reference: `GT-${tag}-${n}`,
        mode: "buy",
        type: "apartment",
        price_aed: 1_000_000,
        ...fields,
      })
      .select("id")
      .single();
    if (error) throw error;
    createdProperties.push(data.id);
    return data.id as string;
  }

  async function makeArea(kind: string, parent_id: string | null = null) {
    const n = created.length;
    const name = `Guard test ${kind} ${n} ${tag}`;
    const { data, error } = await service
      .from("areas")
      .insert({ name, slug: `guard-${kind}-${n}-${tag}`, kind, parent_id })
      .select("id, name")
      .single();
    if (error) throw error;
    created.unshift(data.id);
    return data as { id: string; name: string };
  }

  beforeAll(() => {
    service = client(local, local.serviceRoleKey);
  });

  afterAll(async () => {
    if (createdProperties.length)
      await service.from("properties").delete().in("id", createdProperties);
    if (createdDevelopments.length)
      await service.from("developments").delete().in("id", createdDevelopments);
    // Children first: the guard applies to cleanup too.
    for (const id of created) await service.from("areas").delete().eq("id", id);
  });

  it("deletes an area nothing sits in", async () => {
    const area = await makeArea("building");
    const { error } = await service.from("areas").delete().eq("id", area.id);
    expect(error).toBeNull();
    const { data } = await service.from("areas").select("id").eq("id", area.id);
    expect(data).toEqual([]);
  });

  it("refuses an area with another area inside it, and says so", async () => {
    const parent = await makeArea("emirate");
    await makeArea("area", parent.id);
    const { error } = await service.from("areas").delete().eq("id", parent.id);
    expect(error?.code).toBe("23503");
    expect(error?.message).toContain(`Area "${parent.name}" is still in use by 1 area inside it`);
  });

  it("refuses an area a project sits in", async () => {
    const { data: dev } = await service
      .from("developments")
      .select("area_id")
      .not("area_id", "is", null)
      .not("published_at", "is", null)
      .limit(1)
      .maybeSingle();
    if (!dev?.area_id) return; // seed without projects — nothing to point at
    const { error } = await service.from("areas").delete().eq("id", dev.area_id);
    expect(error?.code).toBe("23503");
    expect(error?.message).toMatch(/still in use by .*published project/);
  });

  it("refuses an area a published listing sits in, through any of its three columns", async () => {
    const { data: rows } = await service
      .from("properties")
      .select("area_id, sub_community_id, building_id")
      .eq("status", "published")
      .is("deleted_at", null)
      .limit(50);
    const ids = new Set(
      (rows ?? []).flatMap((r) => [r.area_id, r.sub_community_id, r.building_id]).filter(Boolean),
    );
    if (ids.size === 0) return;
    for (const id of ids) {
      const { error } = await service.from("areas").delete().eq("id", id as string);
      expect(error?.code).toBe("23503");
      expect(error?.message).toMatch(/still in use by \d+ published listing/);
    }
  });

  it("refuses an area a new published listing sits in", async () => {
    const area = await makeArea("building");
    await makeProperty({ building_id: area.id, status: "published" });
    const { error } = await service.from("areas").delete().eq("id", area.id);
    expect(error?.code).toBe("23503");
    expect(error?.message).toContain(
      `Area "${area.name}" is still in use by 1 published listing`,
    );
  });

  it("deletes an area only unpublished records sit in, and detaches them", async () => {
    const area = await makeArea("building");
    const draft = await makeProperty({ area_id: area.id, status: "draft" });
    const archived = await makeProperty({ building_id: area.id, status: "archived" });
    const softDeleted = await makeProperty({
      sub_community_id: area.id,
      status: "published",
      deleted_at: new Date().toISOString(),
    });

    const { data: developer } = await service
      .from("developers")
      .select("id")
      .limit(1)
      .maybeSingle();
    let project: string | null = null;
    if (developer) {
      const { data, error } = await service
        .from("developments")
        .insert({
          name: `Guard test project ${tag}`,
          slug: `guard-project-${tag}`,
          developer_id: developer.id,
          area_id: area.id,
          published_at: null,
        })
        .select("id")
        .single();
      if (error) throw error;
      createdDevelopments.push(data.id);
      project = data.id;
    }

    const { error } = await service.from("areas").delete().eq("id", area.id);
    expect(error).toBeNull();

    const { data: props } = await service
      .from("properties")
      .select("id, area_id, sub_community_id, building_id")
      .in("id", [draft, archived, softDeleted]);
    expect(props).toHaveLength(3);
    for (const p of props ?? []) {
      expect([p.area_id, p.sub_community_id, p.building_id]).toEqual([null, null, null]);
    }
    if (project) {
      const { data: dev } = await service
        .from("developments")
        .select("area_id")
        .eq("id", project)
        .single();
      expect(dev?.area_id).toBeNull();
    }
  });
});
