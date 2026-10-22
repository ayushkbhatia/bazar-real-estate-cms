"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { asLocale } from "@/lib/i18n/locales";
import { localiseHref } from "@/lib/i18n/routing";

/**
 * `useRouter`, keeping the flow in the language it is being read in. The
 * flow's paths are written English (`FLOW_PATHS`), as every href on the site
 * is; links get their `/ar` from `@/components/i18n/link`, and the steps that
 * move by code get it here — without it, Continue on `/ar/mortgages/apply`
 * would carry an Arabic applicant on to the English details step.
 */
export function useFlowRouter() {
  const router = useRouter();
  const locale = asLocale(useLocale());
  return useMemo(
    () => ({
      push: (href: string) => router.push(localiseHref(href, locale)),
      replace: (href: string) => router.replace(localiseHref(href, locale)),
      refresh: () => router.refresh(),
    }),
    [router, locale],
  );
}
