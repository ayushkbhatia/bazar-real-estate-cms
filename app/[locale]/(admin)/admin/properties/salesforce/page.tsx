import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { CmsShell } from "@/components/brand/cms-shell";
import { Eyebrow } from "@/components/brand/eyebrow";
import { requireRole } from "@/lib/auth";
import { isSalesforceConfigured } from "@/lib/env";
import { isSandboxOrgHost, salesforceOrgHost } from "@/lib/salesforce/client";
import { propertyUrl } from "@/lib/queries/property-utils";
import {
  getListingSyncSettings,
  getMappingOptions,
  listSalesforceListings,
  type ListingState,
  type SalesforceListingRow,
} from "@/lib/queries/salesforce-listings";
import { listHeartbeats } from "@/lib/queries/health";
import {
  ListingButtons,
  MappingForm,
  SettingsSwitches,
  SyncNowButton,
} from "./_controls";

export const dynamic = "force-dynamic";

const STATE_LABEL: Record<ListingState, string> = {
  live: "live",
  awaiting_approval: "awaiting approval",
  held: "held",
  hidden: "hidden",
  withdrawn: "withdrawn",
  mirror_only: "sandbox",
};

const STATE_STYLE: Record<ListingState, string> = {
  live: "bg-bz-accent/15 text-bz-accent",
  awaiting_approval: "bg-amber-100 text-amber-900",
  held: "bg-red-100 text-red-800",
  hidden: "bg-bz-surface-2 text-bz-muted",
  withdrawn: "bg-bz-surface-2 text-bz-muted",
  mirror_only: "bg-bz-surface-2 text-bz-ink-2",
};

const FIX_LABEL = {
  salesforce: "Fix in Salesforce",
  website: "Fix here",
  wait: "In progress",
} as const;

function ago(iso: string | null, now: Date): string {
  if (!iso) return "never";
  const mins = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function aed(n: number | null): string {
  return n == null ? "—" : `AED ${n.toLocaleString("en")}`;
}

type Pending = { source: string; label: string; count: number };

function pendingMappings(rows: SalesforceListingRow[]) {
  const group = (pick: (r: SalesforceListingRow) => { source: string; label: string } | null) => {
    const m = new Map<string, Pending>();
    for (const r of rows) {
      if (r.state === "withdrawn") continue;
      const v = pick(r);
      if (!v) continue;
      const key = v.source.toLowerCase();
      const cur = m.get(key);
      if (cur) cur.count += 1;
      else m.set(key, { ...v, count: 1 });
    }
    return [...m.values()].sort((a, b) => b.count - a.count);
  };
  return {
    locations: group((r) =>
      r.unresolved.location ? { source: r.unresolved.location, label: r.unresolved.location } : null,
    ),
    developers: group((r) =>
      r.unresolved.developer ? { source: r.unresolved.developer, label: r.unresolved.developer } : null,
    ),
    agents: group((r) => {
      const a = r.unresolved.agent;
      if (!a) return null;
      const source = a.email ?? (a.id ? `sf:${a.id}` : null);
      if (!source) return null;
      return { source, label: [a.name, a.email].filter(Boolean).join(" · ") };
    }),
  };
}

/**
 * Salesforce listings — what the CRM has published, and what became of it.
 *
 * Ordered by who has to act: listings waiting for approval, then held ones
 * with their reasons, each reason labelled with whose job it is. A held
 * listing whose problem is a Salesforce field says which field; one whose
 * problem is ours (a location with no area) is fixed on this page, once, for
 * every listing that shares it.
 */
export default async function SalesforceListingsPage() {
  const { staff } = await requireRole(["admin", "editor", "agent"]);
  const canEdit = staff.role === "admin" || staff.role === "editor";
  const isAdmin = staff.role === "admin";
  const now = new Date();

  const [rows, settings, options, heartbeats] = await Promise.all([
    listSalesforceListings(),
    getListingSyncSettings(),
    getMappingOptions(),
    listHeartbeats(),
  ]);
  const hb = heartbeats.find((h) => h.job === "salesforce-listing-sync") ?? null;
  const org = salesforceOrgHost();
  const sandbox = isSandboxOrgHost(org);
  const pending = pendingMappings(rows);
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.state] = (acc[r.state] ?? 0) + 1;
    return acc;
  }, {});
  const needsMapping =
    pending.locations.length + pending.developers.length + pending.agents.length;

  return (
    <CmsShell
      title="Salesforce listings"
      breadcrumbs={
        <span className="inline-flex items-center gap-1">
          <Link href="/admin/properties" className="hover:text-bz-ink">
            Properties
          </Link>
          <ChevronRight size={11} />
          <span>Salesforce</span>
        </span>
      }
      secondary={
        <Link href="/admin/settings/health" className="text-[12.5px] text-bz-muted hover:text-bz-ink">
          Health
        </Link>
      }
    >
      <div className="flex flex-col gap-10">
        <header className="max-w-[860px]">
          <Eyebrow>Salesforce → website</Eyebrow>
          <h1 className="serif text-[32px] mt-2 font-normal leading-tight" style={{ letterSpacing: "-0.018em" }}>
            Listings the CRM team has published.
          </h1>
          <p className="mt-3 text-[14px] text-bz-muted leading-relaxed">
            Every fifteen minutes the website reads each listing marked Published for the website in
            Salesforce. A complete one becomes a listing here; an incomplete one waits below with the
            reason. Title, description, price, rooms, location, permit and photos come from Salesforce
            and are overwritten on every sync — change them there. The slug, the SEO fields, card
            labels and the short description are the website&rsquo;s own.
          </p>
        </header>

        <section className="rounded-lg border border-bz-border bg-bz-surface p-5 flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-1.5 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mono text-[12.5px] text-bz-ink break-all">
                  {org ?? "no Salesforce org configured"}
                </span>
                {sandbox ? (
                  <span className="text-[10px] mono px-2 py-0.5 rounded uppercase tracking-wider bg-amber-100 text-amber-900">
                    sandbox · nothing is published
                  </span>
                ) : null}
                {settings.paused ? (
                  <span className="text-[10px] mono px-2 py-0.5 rounded uppercase tracking-wider bg-red-100 text-red-800">
                    paused
                  </span>
                ) : null}
                <span className="text-[10px] mono px-2 py-0.5 rounded uppercase tracking-wider bg-bz-bg border border-bz-border text-bz-ink-2">
                  {settings.autoPublish ? "auto-publish on" : "approval required"}
                </span>
                <span className="text-[10px] mono px-2 py-0.5 rounded uppercase tracking-wider bg-bz-bg border border-bz-border text-bz-ink-2">
                  {settings.writeBack ? "writes back to Salesforce" : "read only"}
                </span>
              </div>
              <div className="text-[11.5px] text-bz-muted">
                Last run {ago(hb?.last_run_at ?? settings.lastRunAt, now)}
                {hb?.last_detail ? ` · ${hb.last_detail}` : ""}
              </div>
              {!isSalesforceConfigured ? (
                <div className="text-[11.5px] text-bz-ink-2">
                  Salesforce credentials are not set on this deployment, so nothing is fetched. The
                  lead push and this sync share them.
                </div>
              ) : null}
            </div>
            {isAdmin ? (
              <div className="flex flex-wrap items-center gap-2">
                <SettingsSwitches
                  paused={settings.paused}
                  autoPublish={settings.autoPublish}
                  writeBack={settings.writeBack}
                />
                <SyncNowButton />
              </div>
            ) : null}
          </div>
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-bz-muted">
            {(Object.keys(STATE_LABEL) as ListingState[])
              .filter((s) => counts[s])
              .map((s) => (
                <li key={s}>
                  <span className="text-bz-ink">{counts[s]}</span> {STATE_LABEL[s]}
                </li>
              ))}
            {rows.length === 0 ? <li>No listings seen yet.</li> : null}
          </ul>
        </section>

        {needsMapping > 0 ? (
          <section className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <Eyebrow>Needs a decision</Eyebrow>
              <span className="text-[11.5px] text-bz-muted">answered once, for every listing</span>
            </div>
            {pending.locations.length ? (
              <div className="rounded-lg border border-bz-border bg-bz-surface px-4 py-2">
                <div className="text-[11.5px] text-bz-muted pt-1.5 pb-1">
                  Locations with no matching area on the website
                </div>
                {pending.locations.map((p) =>
                  canEdit ? (
                    <MappingForm key={p.source} kind="location" source={p.source} label={p.label} options={options.areas} count={p.count} />
                  ) : (
                    <div key={p.source} className="py-2 text-[13px] text-bz-ink">{p.label}</div>
                  ),
                )}
              </div>
            ) : null}
            {pending.developers.length ? (
              <div className="rounded-lg border border-bz-border bg-bz-surface px-4 py-2">
                <div className="text-[11.5px] text-bz-muted pt-1.5 pb-1">
                  Developers the website does not list under that name
                </div>
                {pending.developers.map((p) =>
                  canEdit ? (
                    <MappingForm key={p.source} kind="developer" source={p.source} label={p.label} options={options.developers} count={p.count} />
                  ) : (
                    <div key={p.source} className="py-2 text-[13px] text-bz-ink">{p.label}</div>
                  ),
                )}
              </div>
            ) : null}
            {pending.agents.length ? (
              <div className="rounded-lg border border-bz-border bg-bz-surface px-4 py-2">
                <div className="text-[11.5px] text-bz-muted pt-1.5 pb-1">
                  Salesforce agents who are not staff on the website (the listing publishes without an advisor until mapped)
                </div>
                {pending.agents.map((p) =>
                  canEdit ? (
                    <MappingForm key={p.source} kind="agent" source={p.source} label={p.label} options={options.staff} count={p.count} />
                  ) : (
                    <div key={p.source} className="py-2 text-[13px] text-bz-ink">{p.label}</div>
                  ),
                )}
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <Eyebrow>Listings</Eyebrow>
            <span className="text-[11.5px] text-bz-muted">{rows.length} seen</span>
          </div>
          {rows.length === 0 ? (
            <p className="rounded-lg border border-bz-border bg-bz-surface p-6 text-[13px] text-bz-muted">
              Nothing yet. Listings appear here after the first sync that finds one marked Published for
              the website in Salesforce.
            </p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {rows.map((r) => (
                <li key={r.sfListingId} className="rounded-lg border border-bz-border bg-bz-surface p-4">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] mono px-2 py-0.5 rounded uppercase tracking-wider ${STATE_STYLE[r.state]}`}>
                          {STATE_LABEL[r.state]}
                        </span>
                        <span className="mono text-[11.5px] text-bz-ink-2">
                          {[r.name, r.reference].filter(Boolean).join(" · ")}
                        </span>
                        {r.property ? (
                          <span className="mono text-[11.5px] text-bz-muted">→ {r.property.reference}</span>
                        ) : null}
                      </div>
                      <div className="mt-1.5 text-[14px] text-bz-ink break-words">
                        {r.title ?? <span className="text-bz-muted">Untitled in Salesforce</span>}
                      </div>
                      <div className="mt-0.5 text-[12px] text-bz-muted">
                        {[r.location, r.offering, aed(r.price)].filter(Boolean).join(" · ")}
                        {r.imagesTotal > 0 ? ` · photos ${r.imagesReady}/${r.imagesTotal}` : ""}
                        {` · synced ${ago(r.lastSyncedAt, now)}`}
                      </div>

                      {r.state === "withdrawn" && r.withdrawnReason ? (
                        <p className="mt-2 text-[12px] text-bz-ink-2">{r.withdrawnReason}.</p>
                      ) : null}
                      {r.holds.length > 0 ? (
                        <ul className="mt-2.5 flex flex-col gap-1">
                          {r.holds.map((h, i) => (
                            <li key={`${h.code}-${i}`} className="text-[12.5px] text-bz-ink leading-snug">
                              <span className="mono text-[10px] uppercase tracking-wider text-bz-muted me-2">
                                {FIX_LABEL[h.fix]}
                              </span>
                              {h.message}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {r.lastError ? (
                        <p className="mt-2 text-[12px] text-red-700 break-words">{r.lastError}</p>
                      ) : null}
                      {r.notes.length > 0 ? (
                        <details className="mt-2">
                          <summary className="text-[11.5px] text-bz-muted cursor-pointer">
                            {r.notes.length} note{r.notes.length === 1 ? "" : "s"}
                          </summary>
                          <ul className="mt-1.5 flex flex-col gap-1">
                            {r.notes.map((n, i) => (
                              <li key={`${n.code}-${i}`} className="text-[12px] text-bz-ink-2 leading-snug">
                                {n.message}
                              </li>
                            ))}
                          </ul>
                        </details>
                      ) : null}
                    </div>

                    <div className="flex flex-col items-start md:items-end gap-2 shrink-0">
                      {canEdit && !sandbox ? <ListingButtons sfListingId={r.sfListingId} state={r.state} /> : null}
                      <div className="flex gap-3 text-[11.5px]">
                        {r.property ? (
                          <Link href={`/admin/properties/${r.property.id}`} className="text-bz-muted hover:text-bz-ink">
                            Open in editor
                          </Link>
                        ) : null}
                        {r.property && r.property.status === "published" ? (
                          <Link href={propertyUrl(r.property)} target="_blank" rel="noreferrer" className="text-bz-muted hover:text-bz-ink">
                            View on site
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </CmsShell>
  );
}
