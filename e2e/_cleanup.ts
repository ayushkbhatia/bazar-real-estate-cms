import { test } from "@playwright/test";

/**
 * Teardown for the specs that submit a real public form.
 *
 * Three specs drive a live lead form end to end — the property-page enquiry,
 * the valuation wizard and the newsletter signup. There is no test database
 * behind them: `playwright.config.ts` serves a local `next start`, but that
 * server reads the ONE Supabase project CI has a secret for, which is
 * production. Every green run therefore filed a real lead.
 *
 * By 2026-09-23 that had put 663 enquiries, 950 of 952 valuation requests,
 * 957 of 972 newsletter subscribers and 454 form submissions into the client's
 * CMS — an inbox that was ~87% us. The enquiries were archived; the rest is
 * what this file stops from coming back.
 *
 * Deleting rather than archiving, and deleting rather than not submitting:
 *
 * - Not submitting was the obvious fix and the wrong one. These three specs
 *   are the only coverage of the submit path, and that path breaks from
 *   CONTENT, not code — `phone` became required on `property_enquiry` on
 *   2026-08-13 and silently stopped the submission going through; the submit
 *   label was renamed from "Send enquiry" to "Submit" and timed the spec out.
 *   Neither has a commit behind it. Dropping the specs would trade a dirty
 *   inbox for an undetectable funnel outage.
 * - Archiving leaves the row in the DSR surface and the analytics counts. A
 *   lead that was never a person should not be either.
 *
 * The specs skip themselves when they cannot clean up (see
 * `installLeadCleanup`), so "wrote to production and left it there" is not a
 * reachable state.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Every table a public lead form can write, with the column it keeps the
 * submitter's address in, children first.
 *
 * `form_submissions.enquiry_id` is ON DELETE SET NULL (0094), so deleting the
 * enquiry first would orphan the submission rather than remove it. Both are
 * matched on the address anyway, which makes the order belt-and-braces — but
 * the order is what keeps a half-finished purge from leaving a widow.
 */
const LEAD_TABLES: ReadonlyArray<readonly [table: string, column: string]> = [
  ["form_submissions", "data->>email"],
  ["enquiries", "email"],
  ["valuation_requests", "owner_email"],
  ["newsletter_subscribers", "email"],
];

/**
 * The only addresses this file will ever delete.
 *
 * A service-role DELETE bypasses RLS, so the filter is the ONLY thing standing
 * between this helper and a real lead. Pinning the exact shapes the specs
 * generate — rather than trusting whatever string a caller passes — means a
 * future edit that widens the address (to a bare `@example.com`, say, or to a
 * value read from the page) fails loudly here instead of quietly taking rows
 * with it. Keep this in step with the specs, and keep it narrow.
 */
const TEST_ADDRESS =
  /^(pw\+\d+@example\.com|pw\+val-\d+@example\.com|playwright\+\d+@bazar\.test)$/;

function assertDisposable(email: string): void {
  if (!TEST_ADDRESS.test(email)) {
    throw new Error(
      `Refusing to purge ${JSON.stringify(email)}: not a recognised test ` +
        `address. Extend TEST_ADDRESS in e2e/_cleanup.ts if a spec has ` +
        `legitimately started generating a new shape.`,
    );
  }
}

/** True when this run can undo what it is about to write. */
export function canPurgeLeads(): boolean {
  return Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);
}

async function purge(email: string): Promise<void> {
  assertDisposable(email);

  for (const [table, column] of LEAD_TABLES) {
    const url =
      `${SUPABASE_URL}/rest/v1/${table}` +
      `?${column}=eq.${encodeURIComponent(email)}`;

    const res = await fetch(url, {
      method: "DELETE",
      headers: {
        apikey: SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        // Without this PostgREST answers 204 with no body, and a cleanup that
        // cannot say what it removed cannot be trusted to have removed it.
        Prefer: "return=representation",
      },
    });

    if (!res.ok) {
      throw new Error(
        `Cleanup failed: DELETE ${table} for ${email} returned ` +
          `${res.status} ${res.statusText}. A test lead is now live in the ` +
          `CMS — remove it by hand.`,
      );
    }
  }
}

/**
 * Install per-test teardown, and return the function a spec tags its address
 * with.
 *
 * Call at the top level of a spec file that submits a form:
 *
 *     const trackLead = installLeadCleanup();
 *     // ...
 *     const email = trackLead(`pw+${ts}@example.com`);
 *
 * Addresses are keyed by test id, not collected in one bag: the suite runs
 * `fullyParallel`, so a file-wide set would let one test's teardown delete a
 * sibling's row while that sibling was still mid-submit.
 *
 * The teardown runs on failure too — a spec that dies after clicking submit is
 * exactly the case that would otherwise leave a row behind.
 */
export function installLeadCleanup(): (email: string) => string {
  const pending = new Map<string, Set<string>>();

  test.afterEach(async () => {
    const id = test.info().testId;
    const emails = pending.get(id);
    pending.delete(id);
    if (!emails) return;
    for (const email of emails) await purge(email);
  });

  return (email: string) => {
    const id = test.info().testId;
    const set = pending.get(id) ?? new Set<string>();
    set.add(email);
    pending.set(id, set);
    return email;
  };
}

/**
 * Guard for a test that is about to file a real lead.
 *
 * Skipping, rather than warning and carrying on: a warning is how the 663
 * enquiries happened. The service-role key is present in CI (`ci.yml` sets it
 * on the Playwright step), so this costs nothing there and only bites a local
 * run that has not exported it — where the right answer really is "don't
 * write to the client's production CMS".
 */
export function skipUnlessPurgeable(): void {
  test.skip(
    !canPurgeLeads(),
    "Submits a real lead to production Supabase and needs " +
      "NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to delete it " +
      "again. Export both (they are in .env.local) to run this spec.",
  );
}
