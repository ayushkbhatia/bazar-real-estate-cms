import Link from "next/link";
import type { SalesforceListingRow } from "@/lib/queries/salesforce-listings";
import { ListingButtons } from "../../salesforce/_controls";

const STATE_COPY: Record<SalesforceListingRow["state"], { label: string; body: string }> = {
  live: {
    label: "Live",
    body: "Published from Salesforce and kept in step with it.",
  },
  awaiting_approval: {
    label: "Awaiting approval",
    body: "Complete, and waiting for someone to approve its first appearance on the website.",
  },
  held: {
    label: "Held",
    body: "Not on the website until the reasons below are fixed.",
  },
  hidden: {
    label: "Hidden",
    body: "Taken off the website here. Salesforce still has it published; it stays off until allowed back.",
  },
  withdrawn: {
    label: "Withdrawn",
    body: "No longer published in Salesforce, so it is off the website.",
  },
  mirror_only: {
    label: "Sandbox",
    body: "From a sandbox org. Evaluated only; never published.",
  },
};

const FIX = { salesforce: "Salesforce", website: "Here", wait: "Wait" } as const;

/**
 * Stands in for the publish card on a listing published from Salesforce.
 *
 * The sync owns this row's status, so a publish button here would be a
 * second owner: it would put the listing up, and the next sync would take it
 * down again if the CRM data were incomplete. What an editor can decide is
 * whether the website shows it at all — hide, allow, approve — and those
 * the sync respects.
 */
export function SalesforceSourceCard({
  listing,
  canDecide,
}: {
  listing: SalesforceListingRow;
  /** Approve / hide / allow are editors' and admins' calls; an agent sees
   *  the state and the reasons without buttons that would refuse them. */
  canDecide: boolean;
}) {
  const copy = STATE_COPY[listing.state];
  return (
    <section className="rounded-lg border border-bz-border bg-bz-surface p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] uppercase tracking-wider text-bz-muted">Salesforce</span>
        <span className="mono text-[11px] text-bz-ink-2">{listing.name ?? listing.sfListingId}</span>
      </div>
      <div>
        <div className="text-[15px] text-bz-ink">{copy.label}</div>
        <p className="mt-1 text-[12.5px] text-bz-muted leading-relaxed">{copy.body}</p>
      </div>
      {listing.holds.length > 0 && listing.state !== "withdrawn" ? (
        <ul className="flex flex-col gap-1.5">
          {listing.holds.map((h, i) => (
            <li key={`${h.code}-${i}`} className="text-[12px] text-bz-ink leading-snug">
              <span className="mono text-[10px] uppercase tracking-wider text-bz-muted mr-1.5">{FIX[h.fix]}</span>
              {h.message}
            </li>
          ))}
        </ul>
      ) : null}
      <p className="text-[11.5px] text-bz-muted leading-relaxed">
        Title, description, price, rooms, location, permit, amenities and photos are overwritten from
        Salesforce on every sync. Edit them there.
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {canDecide && listing.state !== "mirror_only" ? (
          <ListingButtons sfListingId={listing.sfListingId} state={listing.state} />
        ) : (
          <span />
        )}
        <Link href="/admin/properties/salesforce" className="text-[11.5px] text-bz-muted hover:text-bz-ink">
          All Salesforce listings →
        </Link>
      </div>
    </section>
  );
}
