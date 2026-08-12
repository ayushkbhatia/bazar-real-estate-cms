import { PublicMegaNav } from "@/components/brand/public-mega-nav";
import { PublicFooter } from "@/components/brand/public-footer";
import { getPublishedMegamenuHydrated } from "@/lib/queries/megamenu-hydrate";
import { listFloatingCtas } from "@/lib/queries/floating-ctas";
import { getPublicBranding } from "@/lib/queries/site-settings";
import { getAdvisorWhatsAppNumber } from "@/lib/whatsapp";
import { PreferencesPopover } from "./_components/preferences-popover";
import { MobilePreferences } from "./_components/mobile-preferences";
import { ShortlistDrawer } from "./_components/shortlist-drawer";
import { FooterTrust } from "./_components/footer-trust";
import { FloatingCtaProvider } from "./_components/floating-cta-context";
import { FloatingCtaRail } from "./_components/floating-cta-rail";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [megamenu, floatingCtas, branding] = await Promise.all([
    getPublishedMegamenuHydrated(),
    listFloatingCtas(),
    getPublicBranding(),
  ]);
  // Resolved here rather than inside the nav so the brand component stays a
  // presentational client component with no data dependency of its own.
  const logo = branding.logo_url
    ? {
        url: branding.logo_url,
        style: branding.logo_style,
        name: branding.brand_name,
      }
    : null;
  return (
    // The provider wraps `children` as well as the rail: a detail page deep in
    // the tree publishes its advisor upward through it, which is how one
    // site-wide rail still routes to the person handling that listing.
    <FloatingCtaProvider>
      {/*
        Desktop preferences float as a sibling to the megamenu; the
        mobile equivalent is injected into the hamburger-drawer footer
        via `footerSlot` (the brand nav stays free of app-level imports).
      */}
      <PublicMegaNav
        data={megamenu}
        logo={logo}
        footerSlot={<MobilePreferences />}
      />
      {/* Gate matches PublicMegaNav's xl breakpoint — below it the drawer
          carries the preferences entry via footerSlot, so an md gate here
          would render both controls at once between 768 and 1279. */}
      <div className="hidden xl:flex fixed top-[84px] right-4 z-30">
        <PreferencesPopover />
      </div>
      <main className="flex-1">{children}</main>
      {/*
        T3-B: floating shortlist drawer.  Self-renders nothing until the
        user has at least one shortlisted property, so the corner stays
        clean for fresh visitors.  Sits bottom-left so it doesn't fight
        with the floating CTA rail at bottom-right.
      */}
      <ShortlistDrawer />
      {/* Floating contact CTAs, from `floating_ctas` (see
          /admin/floating-ctas). Mounted here rather than per page so
          WhatsApp floats site-wide; the rail itself decides which buttons
          a given page earns. The env number is resolved server-side so the
          client component never reaches into `lib/env`. */}
      <FloatingCtaRail
        ctas={floatingCtas}
        fallbackPhone={getAdvisorWhatsAppNumber()}
      />
      {/* T1.5 quick win: single-line trust signal above the global footer.
          Wraps the locked PublicFooter rather than editing it. */}
      <FooterTrust />
      <PublicFooter />
    </FloatingCtaProvider>
  );
}
