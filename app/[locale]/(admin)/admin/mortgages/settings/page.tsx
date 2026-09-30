import Link from "next/link";
import { notFound } from "next/navigation";
import { CmsShell } from "@/components/brand/cms-shell";
import { cmsT } from "@/lib/mortgage-requests/cms-strings";
import { getMortgageRole, requireMortgageRole } from "@/lib/mortgage-requests/server/cms-auth";
import { loadPromiseRecord } from "@/lib/mortgage-requests/server/metrics";
import { loadMortgageSettings } from "@/lib/mortgage-requests/server/settings";
import { formatDuration } from "@/lib/mortgage-requests/sla";
import { HolidaysCard, SettingsForm } from "../_components/settings-form";
import { Card, CRUMB_LINK } from "../_components/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return (await getMortgageRole()) === "head" ? { title: cmsT("settings.title") } : {};
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

const t = cmsT as unknown as (key: string, values?: Record<string, string | number>) => string;

/** How far back the promise record looks. */
const RECORD_DAYS = 30;

/**
 * The mortgage module's settings, for the Head of mortgages (not designed;
 * IMPLEMENTATION §1.10): the flow's flag, how new requests are assigned, the
 * loan-to-value figures the application quotes, and the public holidays the
 * promise pauses on. Working hours are shown, not edited: they are the
 * published office hours, changed with the site team.
 */
export default async function MortgageSettingsPage() {
  const { role, supabase } = await requireMortgageRole();
  if (role !== "head") notFound();
  const { settings, holidays, policy } = await loadMortgageSettings(supabase);
  const record = await loadPromiseRecord(supabase, { now: new Date(), policy, days: RECORD_DAYS });

  return (
    <CmsShell
      title={cmsT("settings.title")}
      breadcrumbs={
        <>
          {cmsT("nav.group")} › <Link href="/admin/mortgages" className={CRUMB_LINK}>{cmsT("nav.mortgages")}</Link> › {cmsT("settings.link")}
        </>
      }
    >
      <div className="grid max-w-[1000px] items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-4">
          <SettingsForm settings={settings} />
          <HolidaysCard holidays={holidays} />
        </div>
        <div className="flex flex-col gap-4">
          <Card title={t("settings.promise.title", { days: RECORD_DAYS })}>
            {record.decided === 0 || record.metPct === null ? (
              <p className="text-[13px] text-bz-muted">{t("settings.promise.none", { days: RECORD_DAYS })}</p>
            ) : (
              <div className="flex flex-col gap-1.5 text-[13px]">
                <p className="serif text-[34px] leading-none">{record.metPct}%</p>
                <p>{t("settings.promise.met", { met: record.met, decided: record.decided, pct: record.metPct })}</p>
                {record.medianSeconds !== null ? (
                  <p className="text-bz-muted">{t("settings.promise.median", { duration: formatDuration(record.medianSeconds) })}</p>
                ) : null}
                {record.missed > 0 ? (
                  <p className="text-[oklch(0.45_0.13_28)]">{t("settings.promise.missed", { count: record.missed })}</p>
                ) : null}
              </div>
            )}
          </Card>
          <Card title={t("settings.retention.title")}>
            <p className="text-[13px]">
              {settings.retention_months
                ? t("settings.retention.set", { months: settings.retention_months })
                : t("settings.retention.unset")}
            </p>
            <p className="mt-1.5 text-[12px] text-bz-muted">{t("settings.retention.how")}</p>
          </Card>
          <Card title={cmsT("settings.hours.title")}>
            <dl className="text-[13px]">
              {WEEKDAYS.map((name, day) => {
                const windows = settings.working_hours[String(day)] ?? [];
                return (
                  <div key={name} className="flex justify-between gap-4 border-t border-bz-border py-2 first:border-t-0">
                    <dt className="text-bz-muted">{name}</dt>
                    <dd className="mono">
                      {windows.length ? windows.map(([a, b]) => `${a}–${b}`).join(", ") : cmsT("settings.hours.closed")}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </Card>
        </div>
      </div>
    </CmsShell>
  );
}
