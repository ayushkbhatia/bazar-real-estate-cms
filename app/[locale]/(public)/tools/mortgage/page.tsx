import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Eyebrow } from "@/components/brand/eyebrow";
import { getForm } from "@/lib/queries/forms";
import { asLocale } from "@/lib/i18n/locales";
import { MortgageCalculator } from "./mortgage-calculator";

export const metadata: Metadata = {
  title: "Mortgage calculator",
  description:
    "All-in mortgage maths for Abu Dhabi: monthly payment, true cash to close (DLD, trustee, valuation, advisory), affordability check against Central Bank UAE DBR rules, and side-by-side scenario compare.",
};

export default async function MortgagePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = asLocale((await params).locale);
  setRequestLocale(locale);
  // Explicit locale rather than the ambient one: `getTranslations("tools")`
  // resolves through `headers()` when nothing has cached the request locale,
  // which takes the route dynamic and discards its cache behaviour silently.
  const t = await getTranslations({ locale, namespace: "tools" });

  // Resolved here rather than inside the calculator because `getForm` is a
  // server read and the calculator is a client component — a `ResolvedForm` is
  // plain JSON and crosses the boundary intact, the same way the dialogs do it.
  const preApprovalForm = await getForm("mortgage_preapproval");

  return (
    <div className="bg-bz-bg">
      <section className="px-4 md:px-12 pt-12 md:pt-20 pb-6">
        <Eyebrow>{t("mortgage.eyebrow")}</Eyebrow>
        <h1
          className="serif text-[36px] md:text-[64px] font-normal mt-3 leading-[1.0] max-w-[16ch]"
          style={{ letterSpacing: "-0.025em" }}
        >
          {/*
            Lead plus emphasis, the same two-field shape `service-hero.tsx` and
            `master-content.tsx` already use for their DB-authored headings. It
            pins the italic run to the end of the sentence, which is a real
            constraint in Arabic — but it is the constraint the CMS-authored
            heroes already carry, so the translator meets one convention rather
            than two.
          */}
          {t("mortgage.headingLead")}{" "}
          <em className="italic">{t("mortgage.headingEmphasis")}</em>
        </h1>
        <p className="mt-5 max-w-[64ch] text-[16px] text-bz-ink-2 leading-relaxed">
          {t("mortgage.intro")}
        </p>
      </section>

      <MortgageCalculator preApprovalForm={preApprovalForm} />
    </div>
  );
}
