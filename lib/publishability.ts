import type { PropertyCompliance } from "@/lib/schemas/property";
import { COMPLIANCE_LABELS } from "@/lib/schemas/property";

export type PublishabilityInput = {
  status: string;
  has_hero: boolean;
  /** Optional so callers that don't track the developer (e.g. the bulk-publish
   *  path) are unaffected; the gate only applies when a value is supplied. */
  has_developer?: boolean;
  /** When true, Power of Attorney is tracked but not a blocker (its label is
   *  "if applicable"). Opt-in so the stricter bulk-publish path is unchanged. */
  poa_optional?: boolean;
  listing_permit_no: string | null;
  listing_permit_expires_at: string | null; // ISO date
  slug: string | null;
  title: string | null;
  price_aed: number | null;
  compliance: PropertyCompliance | null;
  /** Override "now" for testing. */
  now?: Date;
};

export type PublishabilityResult = {
  ok: boolean;
  blockers: string[];
  /** A short, ordered list of pre-flight checks for display in the UI. */
  checks: { label: string; passed: boolean }[];
};

/**
 * Pure pre-flight check. Anything in `blockers` will be returned to the
 * caller as a reason the property cannot be published.
 *
 * The same checks are mirrored in `checks[]` for UI rendering.
 */
export function evaluatePublishability(
  input: PublishabilityInput,
): PublishabilityResult {
  const now = input.now ?? new Date();
  const blockers: string[] = [];
  const checks: { label: string; passed: boolean }[] = [];

  const compliance: PropertyCompliance = input.compliance ?? {
    form_a: false,
    title_deed: false,
    noc: false,
    power_of_attorney: false,
  };

  // Power of Attorney is genuinely "(if applicable)". When the caller opts into
  // poa_optional it is tracked but not a blocker; otherwise all four remain
  // required (the bulk-publish path stays strict). Form A, Title deed, and NOC
  // are always required.
  const REQUIRED_COMPLIANCE: (keyof PropertyCompliance)[] = input.poa_optional
    ? ["form_a", "title_deed", "noc"]
    : ["form_a", "title_deed", "noc", "power_of_attorney"];
  for (const key of REQUIRED_COMPLIANCE) {
    const passed = compliance[key] === true;
    checks.push({ label: COMPLIANCE_LABELS[key], passed });
    if (!passed) blockers.push(`${COMPLIANCE_LABELS[key]} not ticked`);
  }

  const heroPassed = input.has_hero === true;
  checks.push({ label: "At least one hero image", passed: heroPassed });
  if (!heroPassed) blockers.push("No hero image set");

  if (input.has_developer !== undefined) {
    const developerPassed = input.has_developer === true;
    checks.push({ label: "Developer is set", passed: developerPassed });
    if (!developerPassed) blockers.push("Developer is missing");
  }

  const titlePassed = !!(input.title && input.title.trim().length >= 3);
  checks.push({ label: "Title is set", passed: titlePassed });
  if (!titlePassed) blockers.push("Title is missing");

  const slugPassed = !!(input.slug && /^[a-z0-9-]{3,}$/.test(input.slug));
  checks.push({ label: "URL slug is valid", passed: slugPassed });
  if (!slugPassed) blockers.push("Slug is missing or invalid");

  const pricePassed = typeof input.price_aed === "number" && input.price_aed > 0;
  checks.push({ label: "Price is set", passed: pricePassed });
  if (!pricePassed) blockers.push("Price is missing or zero");

  const permitNoPassed =
    !!input.listing_permit_no && input.listing_permit_no.trim().length > 0;
  checks.push({ label: "Listing permit no. is recorded", passed: permitNoPassed });
  if (!permitNoPassed) blockers.push("Listing permit number is missing");

  const permitExpiryPassed = (() => {
    const raw = input.listing_permit_expires_at;
    if (!raw) return false;
    // Compare date-to-date, not date-to-timestamp: a permit is valid through
    // its whole expiry day. Date.parse("YYYY-MM-DD") is UTC midnight, which
    // would fail against a mid-day `now` on the expiry day itself.
    const [y, m, d] = raw.split("-").map(Number);
    if (!y || !m || !d) return false;
    const expiry = new Date(y, m - 1, d).getTime();
    const today = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).getTime();
    return expiry >= today;
  })();
  checks.push({
    label: "Listing permit not expired",
    passed: permitExpiryPassed,
  });
  if (!permitExpiryPassed)
    blockers.push("Listing permit expires_at is missing or in the past");

  return { ok: blockers.length === 0, blockers, checks };
}
