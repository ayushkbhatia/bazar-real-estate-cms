import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Download } from "lucide-react";
import { asLocale } from "@/lib/i18n/locales";
import { DOC_LABEL_KEY } from "@/lib/mortgage-requests/activity";
import { formatBytes, formatLongDate } from "@/lib/mortgage-requests/cms-format";
import { cmsT } from "@/lib/mortgage-requests/cms-strings";
import { formatMonthShort, formatPeriodChip } from "@/lib/mortgage-requests/coverage";
import { formatDayTime } from "@/lib/mortgage-requests/format";
import { bankLabel, findPackage, logBankAccess, packageState, packageView } from "@/lib/mortgage-requests/server/banks";
import { EMPLOYMENT_KEY, RESIDENCY_KEY } from "@/lib/mortgage-requests/server/cms-queries";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * A partner bank's package (Phase 6; SPEC §8): the page behind the link in
 * the bank's email. A structured summary and the accepted documents, each
 * downloaded through a logged route. Opening the page is itself written to
 * the activity log, as the bank, before anything about the applicant is
 * rendered; a withdrawn, expired or unknown link shows nothing of them.
 * The token is the URL, so the page sends no referrer and stays out of search.
 */

// Every open is logged, so it renders every time; the (mortgage) layout says so too.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

const t = cmsT as unknown as (key: string, values?: Record<string, string | number>) => string;

export default async function PackagePage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  setRequestLocale(asLocale(locale));

  const db = createAdminClient();
  const found = db ? await findPackage(db, token) : null;
  const state = packageState(found, new Date());
  if (!db || !found || state !== "open") {
    const key = state === "expired" ? "expired" : "unavailable";
    return (
      <main className="flex-1 px-4 pt-[30px] pb-16 md:px-6 lg:px-12">
        <div className="mx-auto max-w-[760px]">
          <h1 className="serif text-[40px] leading-[1.05] tracking-[-0.02em]">{t(`pkg.state.${key}.title`)}</h1>
          <p className="mt-4 text-[16px] leading-[1.6] text-bz-ink-2">{t(`pkg.state.${key}.body`)}</p>
        </div>
      </main>
    );
  }

  await logBankAccess(db, {
    requestId: found.submission.request_id,
    type: "bank.package_opened",
    data: { bank: found.bank.code, label: bankLabel(found.bank) },
  });
  const view = await packageView(db, found);

  const rows: [string, string][] = [
    [t("field.fullName"), view.applicant.fullName],
    [t("field.dateOfBirth"), formatLongDate(view.applicant.dateOfBirth)],
    [t("c2.applicant.residency"), t(RESIDENCY_KEY[view.applicant.residency])],
    [t("c2.applicant.employment"), t(EMPLOYMENT_KEY[view.applicant.employment])],
    ...(view.recorded.monthlyGrossAed !== null
      ? ([[t("pkg.field.salary"), `AED ${view.recorded.monthlyGrossAed.toLocaleString("en-US")}`]] as [string, string][])
      : []),
    ...(view.recorded.employer ? ([[t("pkg.field.employer"), view.recorded.employer]] as [string, string][]) : []),
    ...(view.recorded.employedSince
      ? ([[t("pkg.field.employedSince"), formatMonthShort(view.recorded.employedSince.slice(0, 7))]] as [string, string][])
      : []),
    [t("pkg.field.ltv"), `${view.ltvPct}%`],
  ];

  return (
    <main className="flex-1 px-4 pt-[30px] pb-16 md:px-6 lg:px-12">
      <div className="mx-auto max-w-[760px]">
        <div className="eyebrow">{t("pkg.eyebrow", { reference: view.reference })}</div>
        <h1 className="serif mt-3 text-[40px] leading-[1.05] tracking-[-0.02em] md:text-[48px]">{t("pkg.title")}</h1>
        <p className="mt-4 text-[15px] leading-[1.6] text-bz-ink-2">
          {t("pkg.lede", {
            adviser: view.adviser ?? "Bazar",
            bank: view.bank.name,
            sentAt: formatDayTime(view.sentAt),
            expires: formatDayTime(view.expiresAt),
          })}
        </p>

        <section className="mt-8 rounded-[14px] border border-bz-border bg-bz-surface">
          <h2 className="border-b border-bz-border px-5 py-3.5 text-[14px] font-medium">{t("pkg.summary")}</h2>
          <dl className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2">
            {rows.map(([label, value]) => (
              <div key={label} className="min-w-0">
                <dt className="text-[11.5px] text-bz-muted">{label}</dt>
                <dd className="mt-[3px] text-[13.5px]">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-4 overflow-hidden rounded-[14px] border border-bz-border bg-bz-surface">
          <h2 className="border-b border-bz-border px-5 py-3.5 text-[14px] font-medium">{t("pkg.documents")}</h2>
          <ul>
            {view.documents.map((d) => (
              <li key={d.kind} className="border-t border-bz-border px-5 py-4 first:border-t-0">
                <div className="text-[13.5px] font-medium">{t(DOC_LABEL_KEY[d.kind])}</div>
                <ul className="mt-2 flex flex-col gap-2">
                  {d.files.map((f) => {
                    const meta = [
                      f.periodFrom && f.periodTo ? formatPeriodChip(f.periodFrom, f.periodTo) : null,
                      f.pageCount ? t("viewer.pages", { count: f.pageCount }) : null,
                      formatBytes(f.sizeBytes),
                    ]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <li key={f.id} className="flex items-center gap-3">
                        <span className="mono min-w-0 flex-1 truncate text-[12.5px]" title={f.name}>
                          {t("pkg.fileMeta", { name: f.name, meta })}
                        </span>
                        <a
                          href={`/api/mortgage/packages/${encodeURIComponent(token)}/files/${f.id}`}
                          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-bz-border-strong px-3 text-[12.5px] hover:bg-bz-surface-2"
                          rel="noreferrer"
                        >
                          <Download size={14} strokeWidth={1.6} aria-hidden />
                          {t("pkg.download")}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-6 text-[13px] text-bz-muted">{t("pkg.contact")}</p>
      </div>
    </main>
  );
}
