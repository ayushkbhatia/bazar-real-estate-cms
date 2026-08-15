import { RouteMessages } from "@/lib/i18n/route-messages";
import { asLocale } from "@/lib/i18n/locales";

/**
 * The calculators' copy, mounted where the calculators are.
 *
 * `tools` is ~400 keys and is read on four routes. On `CLIENT_NAMESPACES` it
 * would ride the flight payload of all 78 prerendered pages; here it costs the
 * three under `/tools` and nothing anywhere else. See `lib/i18n/route-messages`
 * for why the provider re-sends the base bag rather than just the extra.
 */
export default async function ToolsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  // Explicit, for the reason `(public)/layout.tsx` spells out: a layout
  // renders before the pages beneath it, so an ambient locale read here drops
  // the whole subtree to on-demand rendering.
  const { locale } = await params;
  return (
    <RouteMessages locale={asLocale(locale)} namespaces={["tools"]}>
      {children}
    </RouteMessages>
  );
}
