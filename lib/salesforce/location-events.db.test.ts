/**
 * @vitest-environment node
 */

/**
 * Migrations 0169 and 0172 against the local Supabase stack:
 *
 *   npm run db:local:reset && npm run test:db
 *
 * Skipped with a warning when the stack isn't running, and left out of
 * `npm run test:run`, which has no database of its own.
 *
 * The trigger on `areas` writes what Salesforce's Website Locations API is
 * sent: adds as UPSERT, an area renamed in place as REPLACE, and — since the
 * API took a DELETE (25 Oct 2026) — deletes and the old place of anything
 * that moved, as pending DELETEs ahead of the UPSERT of where it is now.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  client,
  localStack,
  type LocalStack,
} from "../mortgage-requests/testing/local-stack";

const stack = localStack();
if (!stack) {
  console.warn("location-event trigger tests skipped: start the local stack with `npm run db:local:reset`");
}

type Payload = {
  action: string;
  emirate: string | null;
  area: string | null;
  newArea?: string;
  subAreas?: string[];
};

describe.skipIf(!stack)("areas → salesforce_location_events (local Supabase)", () => {
  const local = stack as LocalStack;
  const tag = randomUUID().slice(0, 8);
  let service: SupabaseClient;
  const created: string[] = [];
  let since: string;

  async function makeArea(kind: string, name: string, parent_id: string | null = null) {
    const n = created.length;
    const { data, error } = await service
      .from("areas")
      .insert({ name, slug: `sf-loc-${kind}-${n}-${tag}`, kind, parent_id })
      .select("id")
      .single();
    if (error) throw error;
    created.unshift(data.id);
    return data.id as string;
  }

  /** What the trigger wrote since the last call, oldest first. */
  async function events(): Promise<{ state: string; payload: Payload }[]> {
    const { data, error } = await service
      .from("salesforce_location_events")
      .select("state, payload, created_at")
      .gt("created_at", since)
      .order("created_at", { ascending: true });
    if (error) throw error;
    since = data.length ? data[data.length - 1].created_at : since;
    return data.map(({ state, payload }) => ({ state, payload: payload as Payload }));
  }

  const name = (s: string) => `${s} ${tag}`;

  beforeAll(async () => {
    service = client(local, local.serviceRoleKey);
    since = new Date(Date.now() - 1000).toISOString();
  });

  afterAll(async () => {
    for (const id of created) await service.from("areas").delete().eq("id", id);
    await service
      .from("salesforce_location_events")
      .delete()
      .or(`payload->>emirate.like.*${tag}*,payload->>area.like.*${tag}*`);
  });

  let emirate: string;
  let otherEmirate: string;
  let area: string;
  let otherArea: string;
  let sub: string;

  it("queues an add as UPSERT", async () => {
    emirate = await makeArea("emirate", name("Emirate A"));
    otherEmirate = await makeArea("emirate", name("Emirate B"));
    area = await makeArea("area", name("Area"), emirate);
    otherArea = await makeArea("area", name("Other Area"), emirate);
    sub = await makeArea("sub_community", name("Sub"), area);
    expect(await events()).toEqual([
      { state: "pending", payload: { action: "UPSERT", emirate: name("Emirate A"), area: name("Area") } },
      { state: "pending", payload: { action: "UPSERT", emirate: name("Emirate A"), area: name("Other Area") } },
      {
        state: "pending",
        payload: { action: "UPSERT", emirate: name("Emirate A"), area: name("Area"), subAreas: [name("Sub")] },
      },
    ]);
  });

  it("queues an area renamed in place as REPLACE, and nothing else", async () => {
    await service.from("areas").update({ name: name("Area Renamed") }).eq("id", area);
    expect(await events()).toEqual([
      {
        state: "pending",
        payload: { action: "REPLACE", emirate: name("Emirate A"), area: name("Area"), newArea: name("Area Renamed") },
      },
    ]);
  });

  it("queues a renamed sub-area as DELETE of the old name, then UPSERT of the new", async () => {
    await service.from("areas").update({ name: name("Sub Renamed") }).eq("id", sub);
    expect((await events()).map((e) => e.payload)).toEqual([
      { action: "DELETE", emirate: name("Emirate A"), area: name("Area Renamed"), subAreas: [name("Sub")] },
      { action: "UPSERT", emirate: name("Emirate A"), area: name("Area Renamed"), subAreas: [name("Sub Renamed")] },
    ]);
  });

  it("queues a sub-area moved to another area as DELETE from the old, then UPSERT under the new", async () => {
    await service.from("areas").update({ parent_id: otherArea }).eq("id", sub);
    expect((await events()).map((e) => e.payload)).toEqual([
      { action: "DELETE", emirate: name("Emirate A"), area: name("Area Renamed"), subAreas: [name("Sub Renamed")] },
      { action: "UPSERT", emirate: name("Emirate A"), area: name("Other Area"), subAreas: [name("Sub Renamed")] },
    ]);
  });

  it("queues an area moved to another emirate as DELETE, then UPSERT carrying its sub-areas back", async () => {
    await service.from("areas").update({ parent_id: otherEmirate }).eq("id", otherArea);
    expect((await events()).map((e) => e.payload)).toEqual([
      { action: "DELETE", emirate: name("Emirate A"), area: name("Other Area") },
      { action: "UPSERT", emirate: name("Emirate B"), area: name("Other Area"), subAreas: [name("Sub Renamed")] },
    ]);
  });

  it("queues nothing for a change Salesforce doesn't hold", async () => {
    await service.from("areas").update({ slug: `sf-loc-moved-${tag}` }).eq("id", otherArea);
    expect(await events()).toEqual([]);
  });

  it("queues a deleted sub-area, then a deleted area, as pending DELETEs", async () => {
    await service.from("areas").delete().eq("id", sub);
    await service.from("areas").delete().eq("id", otherArea);
    expect(await events()).toEqual([
      {
        state: "pending",
        payload: { action: "DELETE", emirate: name("Emirate B"), area: name("Other Area"), subAreas: [name("Sub Renamed")] },
      },
      { state: "pending", payload: { action: "DELETE", emirate: name("Emirate B"), area: name("Other Area") } },
    ]);
  });
});
