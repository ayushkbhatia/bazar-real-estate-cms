/**
 * @vitest-environment node
 */

/**
 * `audit_log.target_id` against the local Supabase stack (migration 0153):
 *
 *   npm run db:local:reset && npm run test:db
 *
 * Skipped with a warning when the stack isn't running, and left out of
 * `npm run test:run`, which has no database of its own.
 *
 * While the column was a uuid, every audit whose target has no uuid — the
 * site-settings singleton, the CTA rail, a form key, a DSR subject's email —
 * failed its insert, and logAudit() swallowed the failure. This writes those
 * ids the way logAudit() does (a signed-in staff member's own session, through
 * the RLS insert policy) and reads them back, and checks the audit-log
 * viewer's free-text search, which filters `target_id ilike`.
 */

import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  client,
  createTestStaff,
  localStack,
  retireTestStaff,
  type LocalStack,
  type TestStaff,
} from "./mortgage-requests/testing/local-stack";

const stack = localStack();
if (!stack) {
  console.warn("audit database tests skipped: start the local stack with `npm run db:local:reset`");
}

describe.skipIf(!stack)("audit_log.target_id (local Supabase)", () => {
  const local = stack as LocalStack;
  // One action per run, so the rows this file writes are its own to find and remove.
  const action = `test.audit_target.${randomUUID().slice(0, 8)}`;
  let service: SupabaseClient;
  let staff: TestStaff;

  beforeAll(async () => {
    service = client(local, local.serviceRoleKey);
    staff = await createTestStaff(local, service, "support", null);
  });

  afterAll(async () => {
    if (service) {
      await service.from("audit_log").delete().eq("action", action);
      await retireTestStaff(service);
    }
  });

  const write = (target_kind: string, target_id: string | null) =>
    staff.client.from("audit_log").insert({
      actor_id: staff.id,
      actor_kind: "user",
      action,
      target_kind,
      target_id,
      before: null,
      after: { test: true },
    });

  it.each([
    ["a row's uuid", "property", randomUUID()],
    ["the site-settings singleton", "site_settings", "1"],
    ["the Salesforce sync settings", "salesforce_listing_sync", "settings"],
    ["the floating-CTA rail", "floating_ctas", "rail"],
    ["a form", "form", "contact-general"],
    ["a data subject", "data_subject", "subject@example.com"],
    ["a Salesforce mapping", "salesforce_mapping", "community:al reem island"],
    ["a mortgage holiday", "mortgage_holidays", "2026-12-02"],
  ])("keeps %s's id as written", async (_label, target_kind, target_id) => {
    const { error } = await write(target_kind, target_id);
    expect(error).toBeNull();

    const { data } = await service
      .from("audit_log")
      .select("target_id")
      .eq("action", action)
      .eq("target_kind", target_kind)
      .eq("target_id", target_id);
    expect(data).toEqual([{ target_id }]);
  });

  it("still takes no target at all", async () => {
    expect((await write("staff_invitation", null)).error).toBeNull();
  });

  it("is searchable from the audit-log viewer", async () => {
    expect((await write("form", "valuation-request")).error).toBeNull();
    // lib/queries/audit.ts's free-text filter, as it sends it.
    const { data, error } = await service
      .from("audit_log")
      .select("target_kind, target_id")
      .eq("action", action)
      .or(`action.ilike.%no-such-action%,target_id.ilike.%valuation%`);
    expect(error).toBeNull();
    expect(data).toEqual([{ target_kind: "form", target_id: "valuation-request" }]);
  });
});
