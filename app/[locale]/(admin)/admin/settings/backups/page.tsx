/**
 * /admin/settings/backups — read-only summary of the backup + DSR-export
 * posture today. Restore + one-shot CSV-export UI lands later; this page
 * surfaces what's actually in place so the team and client aren't
 * staring at a placeholder.
 */

import { Eyebrow } from "@/components/brand/eyebrow";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { env, isSupabaseConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

type DsrCounts = {
  pending: number;
  fulfilled: number;
  expired: number;
};

async function loadDsrCounts(): Promise<DsrCounts> {
  if (!isSupabaseConfigured) return { pending: 0, fulfilled: 0, expired: 0 };
  try {
    const sb = await createSupabaseServerClient();
    const [pendingRes, fulfilledRes, expiredRes] = await Promise.all([
      sb
        .from("dsr_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
      sb
        .from("dsr_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "fulfilled"),
      sb
        .from("dsr_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "expired"),
    ]);
    return {
      pending: pendingRes.count ?? 0,
      fulfilled: fulfilledRes.count ?? 0,
      expired: expiredRes.count ?? 0,
    };
  } catch {
    return { pending: 0, fulfilled: 0, expired: 0 };
  }
}

function supabaseDashboardUrl(): string | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!match) return null;
  return `https://supabase.com/dashboard/project/${match[1]}`;
}

const RETENTION_RULES: { entity: string; period: string; why: string }[] = [
  {
    entity: "KYC documents (passport, Emirates ID, proof of funds)",
    period: "7 years from end of relationship",
    why: "UAE AML / CFT — federal decree-law 20 of 2018",
  },
  {
    entity: "Deals + transaction documents",
    period: "7 years from completion",
    why: "UAE AML / CFT — same statute",
  },
  {
    entity: "Audit log",
    period: "Indefinite (anonymised on DSR deletion)",
    why: "AML reconstruction; IP / UA scrubbed on user request",
  },
  {
    entity: "Enquiries + viewings + messages",
    period: "Indefinite (PII scrubbed on DSR deletion)",
    why: "AML reconstruction; inline PII redacted on user request",
  },
  {
    entity: "Saved properties, searches, comparisons, recently viewed",
    period: "Until deletion request",
    why: "No AML value; hard-deleted on DSR",
  },
];

export default async function AdminSettingsBackupsPage() {
  const dsr = await loadDsrCounts();
  const dashboardUrl = supabaseDashboardUrl();

  return (
    <div>
      <Eyebrow>Settings · Backups & exports</Eyebrow>
      <h2
        className="serif text-[28px] mt-2 leading-tight"
        style={{ letterSpacing: "-0.012em" }}
      >
        Backups & exports
      </h2>
      <p className="mt-3 text-[14px] text-bz-ink-2 max-w-[60ch] leading-relaxed">
        Point-in-time recovery is provided by Supabase; per-entity CSV
        export UI lands later. This page summarises the data-subject-
        request queue and the regulatory retention rules that govern
        what we can (and can&apos;t) wipe.
      </p>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-[760px]">
        <StatCard label="DSR pending" value={dsr.pending} />
        <StatCard label="DSR fulfilled" value={dsr.fulfilled} />
        <StatCard label="DSR expired" value={dsr.expired} />
      </div>

      <section className="mt-10 max-w-[760px]">
        <Eyebrow>Supabase backups</Eyebrow>
        <p className="mt-2 text-[13.5px] text-bz-ink-2 leading-relaxed">
          Postgres point-in-time recovery is managed via the Supabase
          dashboard. The active plan determines retention (Pro tier:
          7-day PITR; Team tier: 14-day). Restores run from the
          dashboard, not from this page.
        </p>
        {dashboardUrl ? (
          <a
            href={dashboardUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-[13.5px] text-bz-accent underline underline-offset-2"
          >
            Open Supabase dashboard →
          </a>
        ) : (
          <p className="mt-3 text-[13px] text-bz-muted">
            Set <code className="mono text-[12.5px]">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
            to link directly to the dashboard.
          </p>
        )}
      </section>

      <section className="mt-10 max-w-[860px]">
        <Eyebrow>Retention rules</Eyebrow>
        <div className="mt-3 rounded-md border border-bz-border bg-bz-surface overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-bz-bg text-bz-muted text-[11.5px] uppercase tracking-wider">
              <tr>
                <th className="text-start px-3 py-2 font-normal">Entity</th>
                <th className="text-start px-3 py-2 font-normal">Period</th>
                <th className="text-start px-3 py-2 font-normal">Why</th>
              </tr>
            </thead>
            <tbody>
              {RETENTION_RULES.map((r) => (
                <tr key={r.entity} className="border-t border-bz-border">
                  <td className="px-3 py-2">{r.entity}</td>
                  <td className="px-3 py-2 mono text-[12px]">{r.period}</td>
                  <td className="px-3 py-2 text-bz-ink-2">{r.why}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-10 rounded-md border border-dashed border-bz-border bg-bz-surface p-6 max-w-[640px]">
        <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
          Planned enhancements
        </div>
        <div className="mono text-[13px] mt-1 text-bz-accent">
          Phase 7 (launch hardening) + Sprint 8 schema work
        </div>
        <ul className="mt-4 flex flex-col gap-1.5">
          {[
            "Weekly full-DB snapshot list with restore button (admin-only)",
            "One-shot CSV / JSON exports per entity (properties, enquiries, deals, audit)",
            "DSR export queue surface (bulk, beyond the per-subject tool at /admin/dsr)",
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

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-bz-border bg-bz-surface p-4">
      <div className="text-[11.5px] uppercase tracking-wider text-bz-muted">
        {label}
      </div>
      <div className="serif text-[32px] leading-none mt-1">{value}</div>
    </div>
  );
}
