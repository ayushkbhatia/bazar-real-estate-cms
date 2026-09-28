import Link from "next/link";
import { notFound } from "next/navigation";
import { CmsShell } from "@/components/brand/cms-shell";
import { cmsT } from "@/lib/mortgage-requests/cms-strings";
import { getMortgageRole, requireMortgageRole } from "@/lib/mortgage-requests/server/cms-auth";
import { loadMortgageSettings } from "@/lib/mortgage-requests/server/settings";
import { HolidaysCard, SettingsForm } from "../_components/settings-form";
import { Card } from "../_components/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return (await getMortgageRole()) === "head" ? { title: cmsT("settings.title") } : {};
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

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
  const { settings, holidays } = await loadMortgageSettings(supabase);

  return (
    <CmsShell
      title={cmsT("settings.title")}
      breadcrumbs={
        <>
          {cmsT("nav.group")} › <Link href="/admin/mortgages">{cmsT("nav.mortgages")}</Link> › {cmsT("settings.link")}
        </>
      }
    >
      <div className="grid max-w-[1000px] items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-4">
          <SettingsForm settings={settings} />
          <HolidaysCard holidays={holidays} />
        </div>
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
    </CmsShell>
  );
}
