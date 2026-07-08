import { PublicMegaNav } from "@/components/brand/public-mega-nav";
import { PublicFooter } from "@/components/brand/public-footer";
import { getPublishedMegamenuHydrated } from "@/lib/queries/megamenu-hydrate";
import { PreferencesPopover } from "./_components/preferences-popover";
import { MobilePreferences } from "./_components/mobile-preferences";
import { ShortlistDrawer } from "./_components/shortlist-drawer";
import { FooterTrust } from "./_components/footer-trust";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const megamenu = await getPublishedMegamenuHydrated();
  return (
    <>
      {/*
        Desktop preferences float as a sibling to the megamenu; the
        mobile equivalent is injected into the hamburger-drawer footer
        via `footerSlot` (the brand nav stays free of app-level imports).
      */}
      <PublicMegaNav data={megamenu} footerSlot={<MobilePreferences />} />
      <div className="hidden md:flex fixed top-[84px] right-4 z-30">
        <PreferencesPopover />
      </div>
      <main className="flex-1">{children}</main>
      {/*
        T3-B: floating shortlist drawer.  Self-renders nothing until the
        user has at least one shortlisted property, so the corner stays
        clean for fresh visitors.  Sits bottom-left so it doesn't fight
        with the advisor-contact rail at bottom-right.
      */}
      <ShortlistDrawer />
      {/* T1.5 quick win: single-line trust signal above the global footer.
          Wraps the locked PublicFooter rather than editing it. */}
      <FooterTrust />
      <PublicFooter />
    </>
  );
}
