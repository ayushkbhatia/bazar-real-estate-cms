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
 * An area that a listing, project or child area still points at can't be
 * deleted by anyone — the service role included, which skips RLS and so is
 * what a script or the SQL editor would use. The refusal names what is linked.
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

  async function makeArea(kind: string, parent_id: string | null = null) {
    const name = `Guard test ${kind} ${tag}`;
    const { data, error } = await service
      .from("areas")
      .insert({ name, slug: `guard-${kind}-${tag}`, kind, parent_id })
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
      .limit(1)
      .maybeSingle();
    if (!dev?.area_id) return; // seed without projects — nothing to point at
    const { error } = await service.from("areas").delete().eq("id", dev.area_id);
    expect(error?.code).toBe("23503");
    expect(error?.message).toMatch(/still in use by .*project/);
  });

  it("refuses an area a listing sits in, through any of its three columns", async () => {
    const { data: rows } = await service
      .from("properties")
      .select("area_id, sub_community_id, building_id")
      .limit(50);
    const ids = new Set(
      (rows ?? []).flatMap((r) => [r.area_id, r.sub_community_id, r.building_id]).filter(Boolean),
    );
    if (ids.size === 0) return;
    for (const id of ids) {
      const { error } = await service.from("areas").delete().eq("id", id as string);
      expect(error?.code).toBe("23503");
      expect(error?.message).toMatch(/still in use by \d+ listing/);
    }
  });
});
