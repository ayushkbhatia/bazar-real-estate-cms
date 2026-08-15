import { RouteMessages } from "@/lib/i18n/route-messages";
import { asLocale } from "@/lib/i18n/locales";

/**
 * The concierge shares the `tools` namespace with the calculators — same
 * bucket in the message waves, and the chat's own copy is far too small to
 * earn a namespace of its own. Its layout mounts the same route-scoped
 * provider; see `app/[locale]/(public)/tools/layout.tsx`.
 */
export default async function ConciergeLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <RouteMessages locale={asLocale(locale)} namespaces={["tools"]}>
      {children}
    </RouteMessages>
  );
}
