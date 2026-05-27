/**
 * /admin/settings/compliance — read-only summary of licenses + KYC
 * queue + permit expiry. Full editor + suspicious-activity reporting
 * lands later; this page surfaces the regulatory state today.
 */

import Link from "next/link";
import { Eyebrow } from "@/components/brand/eyebrow";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { listLicenses } from "@/lib/queries/licenses";
import type { LicenseStatus, LicenseKind } from "@/lib/types/sprint-8";

export const dynamic = "force-dynamic";

const KIND_LABELS: Record<LicenseKind, string> = {
  orn: "ORN",
  brn: "BRN",
  trakheesi: "Trakheesi",
  rera: "RERA",
  dmt: "DMT",
};

const STATUS_LABELS: Record<LicenseStatus, string> = {
  active: "Active",
  expiring_soon: "Expiring < 30d",
  expired: "Expired",
  revoked: "Revoked",
};

async function countPendingKycDocs(): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  try {
    const sb = await createSupabaseServerClient();
    const { count } = await sb
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("owner_kind", "account")
      .eq("status", "uploaded")
      .is("deleted_at", null);
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function countPermitsExpiringIn30d(): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  try {
    const sb = await createSupabaseServerClient();
    const today = new Date().toISOString().slice(0, 10);
    const in30 = new Date(Date.now() + 30 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const { count } = await sb
      .from("properties")
      .select("id", { count: "exact", head: true })
      .eq("status", "published")
      .is("deleted_at", null)
      .gte("listing_permit_expires_at", today)
      .lte("listing_permit_expires_at", in30);
    return count ?? 0;
  } catch {
    return 0;
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export default async function AdminSettingsCompliancePage() {
  const [licenses, kycPending, expiringPermits] = await Promise.all([
    listLicenses(),
    countPendingKycDocs(),
    countPermitsExpiringIn30d(),
  ]);

  const byStatus: Record<LicenseStatus, number> = {
    active: 0,
    expiring_soon: 0,
    expired: 0,
    revoked: 0,
  };
  for (const l of licenses) byStatus[l.status] += 1;

  const byKind: Record<LicenseKind, number> = {
    orn: 0,
    brn: 0,
    trakheesi: 0,
    rera: 0,
    dmt: 0,
  };
  for (const l of licenses) byKind[l.kind] += 1;

  const upcomingExpiry = licenses
    .filter((l) => l.status !== "expired")
    .slice(0, 8);

  return (
    <div>
      <Eyebrow>Settings · Compliance</Eyebrow>
      <h2
        className="serif text-[28px] mt-2 leading-tight"
        style={{ letterSpacing: "-0.012em" }}
      >
        Compliance · RERA / DMT / KYC
      </h2>
      <p className="mt-3 text-[14px] text-bz-ink-2 max-w-[60ch] leading-relaxed">
        Regulatory state today: licenses (ORN, BRN, Trakheesi/DARI),
        listing-permit expiry, and KYC review queue. The permit-expiry
        cron runs daily at 06:00 UTC and emails admins for properties
        falling within the 30-day window.
      </p>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-[760px]">
        <StatCard
          label="Active licenses"
          value={byStatus.active}
          subValue={`${licenses.length} total`}
        />
        <StatCard
          label="Expiring < 30d"
          value={byStatus.expiring_soon + expiringPermits}
          subValue={`${byStatus.expiring_soon} licenses, ${expiringPermits} permits`}
          highlight={byStatus.expiring_soon + expiringPermits > 0}
        />
        <StatCard
          label="KYC pending"
          value={kycPending}
          subValue="Account docs awaiting review"
          highlight={kycPending > 0}
        />
      </div>

      <section className="mt-10 max-w-[760px]">
        <Eyebrow>License mix</Eyebrow>
        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(byKind) as LicenseKind[]).map((k) => (
            <span
              key={k}
              className="rounded-full border border-bz-border bg-bz-surface px-3 py-1 text-[12.5px]"
            >
              {KIND_LABELS[k]}{" "}
              <span className="mono text-bz-muted">{byKind[k]}</span>
            </span>
          ))}
        </div>
      </section>

      <section className="mt-10 max-w-[860px]">
        <Eyebrow>Next licenses to expire</Eyebrow>
        {upcomingExpiry.length === 0 ? (
          <p className="mt-2 text-[13.5px] text-bz-muted">
            No active licenses in the system yet.
          </p>
        ) : (
          <div className="mt-3 rounded-md border border-bz-border bg-bz-surface overflow-hidden">
            <table className="w-full text-[13px]">
              <thead className="bg-bz-bg text-bz-muted text-[11.5px] uppercase tracking-wider">
                <tr>
                  <th className="text-left px-3 py-2 font-normal">Kind</th>
                  <th className="text-left px-3 py-2 font-normal">Number</th>
                  <th className="text-left px-3 py-2 font-normal">Holder</th>
                  <th className="text-left px-3 py-2 font-normal">Expires</th>
                  <th className="text-left px-3 py-2 font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {upcomingExpiry.map((l) => (
                  <tr key={l.id} className="border-t border-bz-border">
                    <td className="px-3 py-2">{KIND_LABELS[l.kind]}</td>
                    <td className="px-3 py-2 mono text-[12px]">{l.number}</td>
                    <td className="px-3 py-2">
                      {l.holder_name ?? l.holder_kind}
                    </td>
                    <td className="px-3 py-2 mono text-[12px]">
                      {formatDate(l.expires_at)}
                    </td>
                    <td className="px-3 py-2">
                      {STATUS_LABELS[l.status]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10 max-w-[760px]">
        <Eyebrow>Quick actions</Eyebrow>
        <ul className="mt-3 flex flex-col gap-1.5 text-[13.5px]">
          <li>
            ·{" "}
            <Link
              href="/admin/properties?status=published"
              className="text-bz-accent underline underline-offset-2"
            >
              Published properties
            </Link>{" "}
            — sort by listing_permit_expires_at to find what needs
            renewal.
          </li>
          <li>
            ·{" "}
            <Link
              href="/admin/deals"
              className="text-bz-accent underline underline-offset-2"
            >
              Deals
            </Link>{" "}
            — open a deal to review buyer KYC documents.
          </li>
          <li>
            ·{" "}
            <Link
              href="/admin/users"
              className="text-bz-accent underline underline-offset-2"
            >
              Staff
            </Link>{" "}
            — open an advisor to see their BRN status.
          </li>
        </ul>
      </section>

      <div className="mt-10 rounded-md border border-dashed border-bz-border bg-bz-surface p-6 max-w-[640px]">
        <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
          Planned enhancements
        </div>
        <div className="mono text-[13px] mt-1 text-bz-accent">
          Future sprint — license editor + goAML reporting
        </div>
        <ul className="mt-4 flex flex-col gap-1.5">
          {[
            "License editor (issue / renew / upload certificate file)",
            "Per-advisor BRN training-certificate tracker",
            "KYC review queue page with approve / reject actions inline",
            "Suspicious-activity (goAML) reporting workflow",
          ].map((b) => (
            <li key={b} className="text-[13.5px] text-bz-ink-2 leading-snug">
              · {b}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  subValue,
  highlight,
}: {
  label: string;
  value: number;
  subValue?: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-md border border-bz-border bg-bz-surface p-4">
      <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
        {label}
      </div>
      <div
        className={
          highlight
            ? "serif text-[32px] leading-none mt-1 text-bz-accent"
            : "serif text-[32px] leading-none mt-1"
        }
      >
        {value}
      </div>
      {subValue ? (
        <div className="mt-2 text-[12.5px] text-bz-muted">{subValue}</div>
      ) : null}
    </div>
  );
}
