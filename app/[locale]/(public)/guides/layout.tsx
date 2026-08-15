import { RouteMessages } from "@/lib/i18n/route-messages";
import { asLocale } from "@/lib/i18n/locales";

/**
 * The guides' prose, mounted where the guides are.
 *
 * 287 keys — residency thresholds, tenancy steps, document checklists — read
 * on eleven routes and nowhere else. On `CLIENT_NAMESPACES` it would ride the
 * flight payload of all 78 prerendered pages; here it costs the eleven.
 *
 * The pages themselves are Server Components and read this through
 * `getTranslations`, so nothing crosses the boundary yet. The provider is what
 * makes the four eligibility checkers under these routes work once W5b
 * converts them.
 */
export default async function GuidesLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <RouteMessages locale={asLocale(locale)} namespaces={["guides"]}>
      {children}
    </RouteMessages>
  );
}
