import Link from "next/link";
import type { SalesforceListingRow } from "@/lib/queries/salesforce-listings";

/**
 * Where this listing came from, under the publish card.
 *
 * Salesforce supplied the first draft; since then the listing has been the
 * website's (0166). Every field and photo is edited here, it is published
 * here, and the sync does not touch it again — so this card only says so,
 * and raises the one thing a person must decide: the CRM team withdrawing a
 * listing the website still shows.
 */
export function SalesforceSourceCard({ listing }: { listing: SalesforceListingRow }) {
  const withdrawn = listing.state === "withdrawn";
  return (
    <section className="rounded-lg border border-bz-border bg-bz-surface p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] uppercase tracking-wider text-bz-muted">From Salesforce</span>
        <span className="mono text-[11px] text-bz-ink-2">{listing.name ?? listing.sfListingId}</span>
      </div>
      {withdrawn ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2.5 text-[12.5px] text-amber-950 leading-snug">
          <div className="font-medium">No longer published in Salesforce</div>
          <p className="mt-1">
            {listing.withdrawnReason ? `${listing.withdrawnReason}. ` : ""}
            {listing.withdrawnAt
              ? `Since ${new Date(listing.withdrawnAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}. `
              : ""}
            The website has not changed anything. If the property is no longer available, unpublish
            or archive it here.
          </p>
        </div>
      ) : null}
      <p className="text-[12.5px] text-bz-muted leading-relaxed">
        Salesforce supplied the first draft. Everything on this page — text, price, location,
        permit, amenities, labels, photos and whether it is published — is the website&rsquo;s to
        change now. Later edits in Salesforce do not reach it.
      </p>
      {listing.notes.length > 0 ? (
        <details>
          <summary className="text-[11.5px] text-bz-muted cursor-pointer">
            What Salesforce left out of the draft ({listing.notes.length})
          </summary>
          <ul className="mt-1.5 flex flex-col gap-1">
            {listing.notes.map((n, i) => (
              <li key={`${n.code}-${i}`} className="text-[12px] text-bz-ink-2 leading-snug">
                {n.message}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <Link href="/admin/properties/salesforce" className="text-[11.5px] text-bz-muted hover:text-bz-ink self-end">
        All Salesforce listings →
      </Link>
    </section>
  );
}
