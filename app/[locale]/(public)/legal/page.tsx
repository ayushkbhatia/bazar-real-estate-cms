import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

/**
 * `/legal` is only a redirect, but it still has to declare its locale.
 *
 * The public layout above it now reads the locale to resolve branding, and
 * next-intl permits that during static rendering only once `setRequestLocale`
 * has run. Every other page under this segment already calls it; this one did
 * not, because a page whose entire body is a `redirect()` never looked like it
 * needed a locale.
 *
 * Without it the route drops to on-demand rendering. It still redirects
 * correctly — it just stops being prerendered, which is exactly the
 * silent-cost failure `scripts/ci/assert-static-routes.mjs` exists to catch.
 * It caught this one.
 */
export default async function LegalIndexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  redirect("/legal/privacy");
}
